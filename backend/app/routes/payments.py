from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Path, status
from app.database import get_db_cursor
from app.redis_client import clear_ticket_cache
from app.routes.reservations import get_current_user_id
from app.schemas.payments import PaymentRequest, PaymentResponse
from app.schemas.tickets import (
    CancelTicketRequest,
    CancellationPenaltyResponse,
)

router = APIRouter(prefix="/api/payments", tags=["Payments"])


@router.post(
    "/",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Process payment for a pending reservation",
)
def process_payment(
    data: PaymentRequest,
    user_id: int = Depends(get_current_user_id),
):
    try:
        with get_db_cursor() as cursor:
            # 🔴 Add a concurrency lock.
            # Re-check the user's status while locked.
            cursor.execute(
                "SELECT is_active FROM users " "WHERE user_id = %s;",
                (user_id,),
            )
            user = cursor.fetchone()
            if not user or not user["is_active"]:
                raise HTTPException(
                    status_code=403,
                    detail=(
                        "Your account has been deactivated. You "
                        "cannot make payments."
                    ),
                )

            cursor.execute(
                (
                    "SELECT r.reservation_id, r.status, "
                    "r.expires_at, "
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
                    status_code=403,
                    detail=(
                        "Your account has been deactivated. You cannot "
                        "cancel tickets."
                    ),
                )
            if reservation["status"] == "paid":
                raise HTTPException(
                    status_code=400,
                    detail="Reservation is already paid",
                )
            if reservation["status"] == "cancelled":
                raise HTTPException(
                    status_code=400,
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
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Reservation expired. Ticket returned to "
                        "the pool."
                    ),
                )

            cursor.execute(
                (
                    "INSERT INTO payments "
                    "(reservation_id, user_id, amount, payment_method, "
                    "status, paid_at) "
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

            return {
                "payment_id": payment["payment_id"],
                "reservation_id": data.reservation_id,
                "amount": float(reservation["price"]),
                "status": "successful",
                "message": "Payment completed successfully. Ticket issued.",
                "paid_at": payment["paid_at"],
            }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        detail = "Database error: %s" % str(e)
        raise HTTPException(status_code=500, detail=detail)


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
            # 🔴 Add a concurrency lock (FOR UPDATE).
            # Re-check the user's status while locked.
            cursor.execute(
                (
                    "SELECT is_active FROM users "
                    "WHERE user_id = %s FOR UPDATE;"
                ),
                (user_id,),
            )
            user = cursor.fetchone()
            if not user or not user["is_active"]:
                raise HTTPException(
                    status_code=403,
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
                    status_code=404,
                    detail="Reservation not found",
                )
            if data["status"] != "paid":
                raise HTTPException(
                    status_code=400,
                    detail=("Only 'paid' reservations can be cancelled"),
                )

            now = datetime.now()
            if data["match_date"] <= now:
                raise HTTPException(
                    status_code=400,
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
        detail = "Database error: %s" % str(e)
        raise HTTPException(status_code=500, detail=detail)


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
            # 🔴 Add a concurrency lock (FOR UPDATE).
            # Re-check the reservation status while locked.
            cursor.execute(
                "SELECT status, ticket_id FROM reservations "
                "WHERE reservation_id = %s FOR UPDATE;",
                (request.reservation_id,),
            )
            reservation = cursor.fetchone()

            if not reservation:
                raise HTTPException(
                    status_code=404,
                    detail="Reservation not found.",
                )
            if reservation["status"] != "paid":
                raise HTTPException(
                    status_code=400,
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

            return {
                "message": "Ticket successfully cancelled.",
                "refund_amount": penalty_data["refund_amount"],
                "penalty_applied": penalty_data["penalty_amount"],
            }
    except Exception as e:
        # 🔴Adding proper handling for HTTPException errors.
        if isinstance(e, HTTPException):
            raise e
        detail = "Database error: %s" % str(e)
        raise HTTPException(status_code=500, detail=detail)
