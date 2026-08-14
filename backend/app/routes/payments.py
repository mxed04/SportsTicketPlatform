from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Path, status
from app.database import get_db_cursor
from app.redis_client import clear_ticket_cache, pop_from_waitlist
from app.routes.reservations import get_current_user_id
from app.schemas.payments import PaymentRequest, PaymentResponse
from app.schemas.tickets import (
    CancelTicketRequest,
    CancellationPenaltyResponse,
)
import base64
import io
import json
import qrcode

router = APIRouter(prefix="/api/payments", tags=["Payments"])


@router.post(
    "/",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Process payment for a pending reservation and issue QR Ticket",
)
def process_payment(
    data: PaymentRequest,
    user_id: int = Depends(get_current_user_id),
):
    try:
        with get_db_cursor() as cursor:
            # Check if the user account is active
            cursor.execute(
                "SELECT is_active FROM users WHERE user_id = %s;",
                (user_id,),
            )
            user = cursor.fetchone()
            if not user or not user["is_active"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=(
                        "Your account has been deactivated. You "
                        "cannot make payments."
                    ),
                )
            cursor.execute(
                (
                    "SELECT r.reservation_id, r.status, r.expires_at, "
                    "(r.expires_at < NOW()) AS is_expired, t.price, "
                    "t.ticket_id FROM reservations r "
                    "JOIN tickets t ON r.ticket_id = t.ticket_id "
                    "WHERE r.reservation_id = %s "
                    "AND r.user_id = %s "
                    "FOR UPDATE OF r;"
                ),
                (data.reservation_id, user_id),
            )
            reservation = cursor.fetchone()
            if not reservation:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Reservation not found or does not belong to you",
                )
            if reservation["status"] == "paid":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Reservation is already paid",
                )
            if reservation["status"] == "cancelled":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Reservation has been cancelled",
                )
            if reservation["is_expired"]:
                cursor.execute(
                    (
                        "UPDATE reservations SET status = 'cancelled' "
                        "WHERE reservation_id = %s;"
                    ),
                    (data.reservation_id,),
                )
                cursor.execute(
                    (
                        "UPDATE tickets SET remaining_capacity = "
                        "remaining_capacity + 1 WHERE ticket_id = %s;"
                    ),
                    (reservation["ticket_id"],),
                )
                cursor.connection.commit()
                clear_ticket_cache()

                # Waitlist Check on Expiration
                next_user_id = pop_from_waitlist(reservation["ticket_id"])
                if next_user_id:
                    cursor.execute(
                        "SELECT phone_number FROM users WHERE user_id = %s;",
                        (next_user_id,),
                    )
                    lucky_user = cursor.fetchone()
                    if lucky_user:
                        print(
                            f"🔔 MOCK SMS: Hey {lucky_user['phone_number']}, "
                            f"ticket_id {reservation['ticket_id']} just "
                            f"opened up! Hurry!"
                        )

                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Reservation expired. Ticket returned to the pool.",
                )
            cursor.execute(
                (
                    "INSERT INTO payments (reservation_id, user_id, "
                    "amount, payment_method, status, paid_at) "
                    "VALUES (%s, %s, %s, %s, 'successful', NOW()) "
                    "RETURNING payment_id, paid_at;"
                ),
                (
                    data.reservation_id,
                    user_id,
                    reservation["price"],
                    data.payment_method,
                ),
            )
            payment = cursor.fetchone()
            cursor.execute(
                (
                    "UPDATE reservations SET status = 'paid' "
                    "WHERE reservation_id = %s;"
                ),
                (data.reservation_id,),
            )
            cursor.connection.commit()

            # 🔴 NEW: Generate Digital Ticket (QR Code)
            ticket_data = {
                "reservation_id": data.reservation_id,
                "ticket_id": reservation["ticket_id"],
                "payment_id": payment["payment_id"],
                "amount": float(reservation["price"]),
                "paid_at": payment["paid_at"].isoformat(),
            }

            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(json.dumps(ticket_data))
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")

            # Convert image to Base64 string
            buffered = io.BytesIO()
            img.save(buffered, format="PNG")
            qr_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
            qr_code_data_uri = f"data:image/png;base64,{qr_base64}"

            return {
                "payment_id": payment["payment_id"],
                "reservation_id": data.reservation_id,
                "amount": float(reservation["price"]),
                "status": "successful",
                "message": "Payment completed successfully. Ticket issued.",
                "paid_at": payment["paid_at"],
                "qr_code": qr_code_data_uri,
            }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        detail = f"Database error: {str(e)}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail,
        )


@router.get(
    "/cancellation-penalty/{reservation_id}",
    response_model=CancellationPenaltyResponse,
    status_code=status.HTTP_200_OK,
    summary="Calculate penalty for cancelling a ticket",
)
def calculate_cancellation_penalty(
    reservation_id: int = Path(
        ...,
        gt=0,
        description="The ID of the reservation",
    ),
    user_id: int = Depends(get_current_user_id),
):
    try:
        with get_db_cursor() as cursor:
            # Check if the user account is active
            cursor.execute(
                "SELECT is_active FROM users WHERE user_id = %s;",
                (user_id,),
            )
            user = cursor.fetchone()
            if not user or not user["is_active"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=(
                        "Your account has been deactivated. You "
                        "cannot cancel tickets."
                    ),
                )
            cursor.execute(
                (
                    "SELECT r.status, t.match_date, t.price "
                    "FROM reservations r "
                    "JOIN tickets t ON r.ticket_id = t.ticket_id "
                    "WHERE r.reservation_id = %s "
                    "AND r.user_id = %s;"
                ),
                (reservation_id, user_id),
            )
            data = cursor.fetchone()
            if not data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Reservation not found",
                )
            if data["status"] != "paid":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Only 'paid' reservations can be cancelled",
                )
            now = datetime.now()
            if data["match_date"] <= now:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Match has already started. Cannot cancel.",
                )
            time_difference = data["match_date"] - now
            hours_until_match = time_difference.total_seconds() / 3600
            if hours_until_match < 24:
                penalty_percentage = 50
            elif hours_until_match <= 72:
                penalty_percentage = 20
            else:
                penalty_percentage = 0
            price = float(data["price"])
            penalty_amount = price * (penalty_percentage / 100)
            return {
                "reservation_id": reservation_id,
                "match_date": data["match_date"].isoformat(),
                "hours_until_match": round(hours_until_match, 2),
                "penalty_percentage": penalty_percentage,
                "penalty_amount": penalty_amount,
                "refund_amount": price - penalty_amount,
            }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        detail = f"Database error: {str(e)}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail,
        )


@router.post(
    "/cancel",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="Cancel a paid reservation and process refund",
)
def cancel_ticket(
    request: CancelTicketRequest,
    user_id: int = Depends(get_current_user_id),
):
    penalty_data = calculate_cancellation_penalty(
        request.reservation_id,
        user_id,
    )
    try:
        with get_db_cursor() as cursor:
            # Concurrency lock (FOR UPDATE) on reservation row
            # during cancellation
            cursor.execute(
                "SELECT status, ticket_id FROM reservations "
                "WHERE reservation_id = %s FOR UPDATE;",
                (request.reservation_id,),
            )
            reservation = cursor.fetchone()
            if not reservation:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Reservation not found.",
                )
            if reservation["status"] != "paid":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Reservation is not in 'paid' status.",
                )
            cursor.execute(
                (
                    "UPDATE reservations SET status = 'cancelled' "
                    "WHERE reservation_id = %s;"
                ),
                (request.reservation_id,),
            )
            cursor.execute(
                (
                    "UPDATE tickets SET remaining_capacity = "
                    "remaining_capacity + 1 "
                    "WHERE ticket_id = %s;"
                ),
                (reservation["ticket_id"],),
            )
            cursor.connection.commit()
            clear_ticket_cache()

            # Waitlist Check: Notify the next person in line!
            next_user_id = pop_from_waitlist(reservation["ticket_id"])
            if next_user_id:
                cursor.execute(
                    "SELECT phone_number FROM users WHERE user_id = %s;",
                    (next_user_id,),
                )
                lucky_user = cursor.fetchone()
                if lucky_user:
                    message = (
                        f"🔔 MOCK SMS: Hey {lucky_user['phone_number']}, "
                        f"ticket_id {reservation['ticket_id']} just opened up!"
                        "Hurry and reserve it!"
                    )
                    print(message)

            return {
                "message": "Ticket successfully cancelled.",
                "refund_amount": penalty_data["refund_amount"],
                "penalty_applied": penalty_data["penalty_amount"],
            }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        detail = f"Database error: {str(e)}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail,
        )
