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
            # Check if user is active
            cursor.execute(
                "SELECT is_active FROM users WHERE user_id = %s;",
                (user_id,),
            )
            user = cursor.fetchone()
            if not user or not user["is_active"]:
                raise HTTPException(status_code=403, detail="Inactive user")

            # Lock the reservation
            cursor.execute(
                (
                    "SELECT r.reservation_id, r.status, "
                    "r.expires_at, "
                    "(r.expires_at < NOW()) AS is_expired, "
                    "t.price, t.ticket_id, t.remaining_capacity "
                    "FROM reservations r "
                    "JOIN tickets t ON r.ticket_id = t.ticket_id "
                    "WHERE r.reservation_id = %s AND r.user_id = %s "
                    "FOR UPDATE OF r;"
                ),
                (data.reservation_id, user_id),
            )
            res = cursor.fetchone()

            if not res:
                raise HTTPException(status_code=404, detail="Not found")
            if res["status"] == "paid":
                raise HTTPException(status_code=400, detail="Already paid")
            if res["status"] == "cancelled":
                raise HTTPException(status_code=400, detail="Cancelled")
            if res["is_expired"]:
                raise HTTPException(status_code=400, detail="Expired")

            # Calculate surge pricing correctly (15% if capacity < 1000)
            base_price = float(res["price"])
            cap = res["remaining_capacity"]
            final_price = base_price * 1.15 if cap < 1000 else base_price

            # Insert payment with EXACT final price
            cursor.execute(
                (
                    "INSERT INTO payments "
                    "(reservation_id, user_id, amount, "
                    "payment_method, status, paid_at) "
                    "VALUES (%s, %s, %s, %s, 'successful', NOW()) "
                    "RETURNING payment_id, paid_at, amount;"
                ),
                (
                    data.reservation_id,
                    user_id,
                    final_price,
                    data.payment_method,
                ),
            )
            payment = cursor.fetchone()

            # Update reservation status
            cursor.execute(
                (
                    "UPDATE reservations SET status = 'paid' "
                    "WHERE reservation_id = %s;"
                ),
                (data.reservation_id,),
            )
            cursor.connection.commit()

            # Generate QR Code
            ticket_data = {
                "reservation_id": data.reservation_id,
                "ticket_id": res["ticket_id"],
                "payment_id": payment["payment_id"],
                "amount": float(payment["amount"]),
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
                "payment_id": payment["payment_id"],
                "reservation_id": data.reservation_id,
                "amount": float(payment["amount"]),
                "status": "successful",
                "message": "Payment successful.",
                "paid_at": payment["paid_at"].isoformat(),
                "qr_code": qr_uri,
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
            # Fetch reservation and actual paid amount from payments table
            cursor.execute(
                (
                    "SELECT r.status, t.match_date, t.price, "
                    "t.remaining_capacity, p.amount AS paid_amount "
                    "FROM reservations r "
                    "JOIN tickets t ON r.ticket_id = t.ticket_id "
                    "LEFT JOIN payments p "
                    "ON r.reservation_id = p.reservation_id "
                    "WHERE r.reservation_id = %s AND r.user_id = %s;"
                ),
                (reservation_id, user_id),
            )
            data = cursor.fetchone()

            if not data:
                raise HTTPException(status_code=404, detail="Not found")

            # Pending tickets have 0 penalty
            if data["status"] in ["pending", "cancelled"]:
                return {
                    "reservation_id": reservation_id,
                    "match_date": data["match_date"].isoformat(),
                    "hours_until_match": 0.0,
                    "penalty_percentage": 0,
                    "penalty_amount": 0.0,
                    "refund_amount": 0.0,
                }

            if data["status"] != "paid":
                raise HTTPException(status_code=400, detail="Invalid status")

            now = datetime.now()
            if data["match_date"] <= now:
                raise HTTPException(status_code=400, detail="Match started")

            diff = (data["match_date"] - now).total_seconds()
            hours_until = diff / 3600

            if hours_until < 24:
                penalty_pct = 50
            elif hours_until <= 72:
                penalty_pct = 20
            else:
                penalty_pct = 0

            # Use actual paid amount (includes surge) to calculate penalty
            if data["paid_amount"] is not None:
                actual_price = float(data["paid_amount"])
            else:
                cap = data["remaining_capacity"]
                base = float(data["price"])
                actual_price = base * 1.15 if cap < 1000 else base

            penalty_amount = actual_price * (penalty_pct / 100)

            return {
                "reservation_id": reservation_id,
                "match_date": data["match_date"].isoformat(),
                "hours_until_match": round(hours_until, 2),
                "penalty_percentage": penalty_pct,
                "penalty_amount": penalty_amount,
                "refund_amount": actual_price - penalty_amount,
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
            # Lock reservation for update
            cursor.execute(
                (
                    "SELECT status, ticket_id FROM reservations "
                    "WHERE reservation_id = %s FOR UPDATE;"
                ),
                (request.reservation_id,),
            )
            res = cursor.fetchone()

            if not res:
                raise HTTPException(status_code=404, detail="Not found")

            if res["status"] == "cancelled":
                return {
                    "message": "Ticket is already cancelled.",
                    "refund_amount": 0.0,
                    "penalty_applied": 0.0,
                }

            if res["status"] not in ["paid", "pending"]:
                raise HTTPException(status_code=400, detail="Invalid status")

            is_pending = res["status"] == "pending"

            # Mark reservation as cancelled
            cursor.execute(
                (
                    "UPDATE reservations SET status = 'cancelled' "
                    "WHERE reservation_id = %s;"
                ),
                (request.reservation_id,),
            )

            # Mark payment as failed if it was paid
            if not is_pending:
                cursor.execute(
                    (
                        "UPDATE payments SET status = 'failed' "
                        "WHERE reservation_id = %s;"
                    ),
                    (request.reservation_id,),
                )

            # Release capacity back to the pool
            cursor.execute(
                "SELECT remaining_capacity FROM tickets "
                "WHERE ticket_id = %s FOR UPDATE;",
                (res["ticket_id"],),
            )
            t_data = cursor.fetchone()
            current_cap = t_data["remaining_capacity"]

            cursor.execute(
                (
                    "UPDATE tickets SET remaining_capacity = "
                    "remaining_capacity + 1 WHERE ticket_id = %s;"
                ),
                (res["ticket_id"],),
            )
            cursor.connection.commit()

            # Sync capacity with ES and clear caches
            update_ticket_capacity_in_es(res["ticket_id"], current_cap + 1)
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