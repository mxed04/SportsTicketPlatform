from datetime import datetime
import io
import base64
import json
import qrcode
from fastapi import APIRouter, Depends, HTTPException, Path, status
from app.database import get_db_cursor
from app.redis_client import clear_ticket_cache, pop_from_waitlist
from app.routes.reservations import get_current_user_id
from app.schemas.payments import PaymentRequest, PaymentResponse
from app.schemas.tickets import (
    CancelTicketRequest,
    CancellationPenaltyResponse,
)
from app.es_client import update_ticket_capacity_in_es

router = APIRouter(prefix="/api/payments", tags=["Payments"])


# 🚀 FIXED: Reverted to "" to match exact Axios call
@router.post(
    "",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
)
def process_payment(
    data: PaymentRequest,
    user_id: int = Depends(get_current_user_id),
):
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                "SELECT is_active FROM users WHERE user_id = %s;",
                (user_id,),
            )
            user = cursor.fetchone()
            if not user or not user["is_active"]:
                raise HTTPException(
                    status_code=403, detail="Inactive user"
                )

            cursor.execute(
                """
                SELECT r.reservation_id, r.status, r.expires_at,
                (r.expires_at < NOW()) AS is_expired,
                t.price, t.ticket_id, t.remaining_capacity
                FROM reservations r
                JOIN tickets t ON r.ticket_id = t.ticket_id
                WHERE r.reservation_id = %s AND r.user_id = %s
                FOR UPDATE OF r;
                """,
                (data.reservation_id, user_id),
            )
            res = cursor.fetchone()

            # 🚀 FIXED: Descriptive IDOR / Missing error message
            if not res:
                raise HTTPException(
                    status_code=404,
                    detail="Reservation not found or access denied."
                )
            if res["status"] == "paid":
                raise HTTPException(
                    status_code=400, detail="Already paid"
                )
            if res["status"] == "cancelled":
                raise HTTPException(
                    status_code=400, detail="Cancelled"
                )
            if res["is_expired"]:
                raise HTTPException(
                    status_code=400, detail="Expired"
                )

            base_price = float(res["price"])
            cap = res["remaining_capacity"]

            is_surge = (cap + 1) < 1000
            final_price = base_price * 1.15 if is_surge else base_price

            cursor.execute(
                """
                INSERT INTO payments
                (reservation_id, user_id, amount, payment_method,
                 status, paid_at)
                VALUES (%s, %s, %s, %s, 'successful', NOW())
                RETURNING payment_id, paid_at, amount;
                """,
                (
                    data.reservation_id,
                    user_id,
                    final_price,
                    data.payment_method,
                ),
            )
            payment = cursor.fetchone()

            cursor.execute(
                "UPDATE reservations SET status = 'paid' "
                "WHERE reservation_id = %s;",
                (data.reservation_id,),
            )
            cursor.connection.commit()

            pid = payment["payment_id"]
            tracking_code = f"TRK-{pid:06d}-BK"

            try:
                update_ticket_capacity_in_es(res["ticket_id"], cap)
                clear_ticket_cache()
            except Exception:
                pass

            ticket_data = {
                "reservation_id": data.reservation_id,
                "ticket_id": res["ticket_id"],
                "payment_id": pid,
                "amount": float(payment["amount"]),
                "tracking_code": tracking_code,
            }
            qr = qrcode.QRCode(version=1, box_size=10, border=4)
            qr.add_data(json.dumps(ticket_data))
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            qr_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
            qr_uri = f"data:image/png;base64,{qr_b64}"

            return {
                "payment_id": pid,
                "reservation_id": data.reservation_id,
                "amount": float(payment["amount"]),
                "status": "successful",
                "message": "Payment successful. Enjoy the match!",
                "paid_at": payment["paid_at"].isoformat(),
                "qr_code": qr_uri,
                "tracking_code": tracking_code,
            }

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/cancellation-penalty/{reservation_id}",
    response_model=CancellationPenaltyResponse,
)
def calculate_cancellation_penalty(
    reservation_id: int = Path(..., gt=0),
    user_id: int = Depends(get_current_user_id),
):
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                SELECT r.status, t.match_date
                FROM reservations r
                JOIN tickets t ON r.ticket_id = t.ticket_id
                WHERE r.reservation_id = %s AND r.user_id = %s;
                """,
                (reservation_id, user_id),
            )
            meta = cursor.fetchone()

            if not meta:
                raise HTTPException(
                    status_code=404,
                    detail="Reservation not found",
                )

            cursor.execute(
                "SELECT refund_amount, penalty_amount "
                "FROM calculate_cancellation_penalty(%s);",
                (reservation_id,)
            )
            fin = cursor.fetchone()

            now = datetime.now()
            if meta["match_date"] <= now and meta["status"] == "paid":
                raise HTTPException(
                    status_code=400, detail="Match started"
                )

            diff = (meta["match_date"] - now).total_seconds()
            hours_until = diff / 3600 if diff > 0 else 0

            penalty_pct = 0
            if fin["penalty_amount"] > 0:
                total = fin["refund_amount"] + fin["penalty_amount"]
                if total > 0:
                    penalty_pct = int(
                        (fin["penalty_amount"] / total) * 100
                    )

            return {
                "reservation_id": reservation_id,
                "match_date": meta["match_date"].isoformat(),
                "hours_until_match": round(hours_until, 2),
                "penalty_percentage": penalty_pct,
                "penalty_amount": float(fin["penalty_amount"]),
                "refund_amount": float(fin["refund_amount"]),
            }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/cancel",
    response_model=dict,
)
def cancel_ticket(
    request: CancelTicketRequest,
    user_id: int = Depends(get_current_user_id),
):
    penalty_data = calculate_cancellation_penalty(
        request.reservation_id, user_id
    )
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                "SELECT status, ticket_id FROM reservations "
                "WHERE reservation_id = %s FOR UPDATE;",
                (request.reservation_id,),
            )
            res = cursor.fetchone()

            if not res:
                raise HTTPException(
                    status_code=404,
                    detail="Reservation not found or access denied."
                )

            if res["status"] == "cancelled":
                return {
                    "message": "Ticket is already cancelled.",
                    "refund_amount": 0.0,
                    "penalty_applied": 0.0,
                }

            if res["status"] not in ["paid", "pending"]:
                raise HTTPException(
                    status_code=400, detail="Invalid status"
                )

            is_pending = res["status"] == "pending"

            cursor.execute(
                "UPDATE reservations SET status = 'cancelled' "
                "WHERE reservation_id = %s;",
                (request.reservation_id,),
            )

            if not is_pending:
                cursor.execute(
                    "UPDATE payments SET status = 'failed' "
                    "WHERE reservation_id = %s;",
                    (request.reservation_id,),
                )

            cursor.execute(
                "SELECT remaining_capacity FROM tickets "
                "WHERE ticket_id = %s FOR UPDATE;",
                (res["ticket_id"],),
            )
            t_data = cursor.fetchone()
            current_cap = t_data["remaining_capacity"]

            cursor.execute(
                "UPDATE tickets SET remaining_capacity = "
                "remaining_capacity + 1 WHERE ticket_id = %s;",
                (res["ticket_id"],),
            )
            cursor.connection.commit()

            update_ticket_capacity_in_es(
                res["ticket_id"], current_cap + 1
            )
            clear_ticket_cache()
            pop_from_waitlist(res["ticket_id"])

            msg = (
                "Pending reservation cancelled."
                if is_pending
                else "Ticket successfully cancelled."
            )

            return {
                "message": msg,
                "refund_amount": penalty_data["refund_amount"],
                "penalty_applied": penalty_data["penalty_amount"],
            }

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
