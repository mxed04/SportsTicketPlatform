from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from app.schemas.reservations import ReservationRequest, ReservationResponse
from app.database import get_db_cursor
from app.config import settings
from app.redis_client import clear_ticket_cache
import asyncio
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/reservations", tags=["Reservations"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user_id(token: str = Depends(oauth2_scheme)) -> int:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=["HS256"],
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )
        return int(user_id)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


# 🔴 Upgrading the function to full lifecycle management
# (reminders + automatic cancellation)
async def reservation_lifecycle_task(
    reservation_id: int,
    user_id: int,
    ticket_id: int,
):
    # Step 1: A 13-minute wait for the reminder.
    await asyncio.sleep(13 * 60)
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                "SELECT status "
                "FROM reservations "
                "WHERE reservation_id = %s;",
                (reservation_id,),
            )
            result = cursor.fetchone()
            if result and result["status"] == "pending":
                logger.info(
                    (
                        "🔔 [REMINDER] User %s, only 2 minutes remain "
                        "until your ticket reservation "
                        "(Reservation: %s) expires."
                    ),
                    user_id,
                    reservation_id,
                )
            else:
                # If paid or cancelled, no need to proceed.
                return
    except Exception as e:
        logger.error("Error in reminder task phase: %s", str(e))
        return

    # Step 2: Final 2-minute wait and definitive cancellation (15 min total)
    await asyncio.sleep(2 * 60)
    try:
        with get_db_cursor() as cursor:
            # Using FOR UPDATE to prevent conflicts with concurrent payments.
            select_reservation_status_query = (
                "SELECT status FROM reservations WHERE reservation_id = %s "
                "FOR UPDATE;"
            )
            cursor.execute(select_reservation_status_query, (reservation_id,))
            res = cursor.fetchone()

            if res and res["status"] == "pending":
                # Cancel the reservation
                cursor.execute(
                    "UPDATE reservations SET status = 'cancelled' "
                    "WHERE reservation_id = %s;",
                    (reservation_id,),
                )
                # Update the ticket's remaining capacity
                update_ticket_capacity_query = (
                    "UPDATE tickets SET remaining_capacity = "
                    "remaining_capacity + 1 "
                    "WHERE ticket_id = %s;"
                )
                cursor.execute(
                    update_ticket_capacity_query,
                    (ticket_id,),
                )
                cursor.connection.commit()

                # Clear the cache to reflect the updated ticket availability
                clear_ticket_cache()
                logger.info(
                    (
                        "🚫 [EXPIRED] Reservation %s for user %s expired "
                        "and was auto-cancelled."
                    ),
                    reservation_id,
                    user_id,
                )
    except Exception as e:
        logger.error("Error in auto-cancellation task phase: %s", str(e))


@router.post(
    "/",
    response_model=ReservationResponse,
    status_code=status.HTTP_201_CREATED,
    summary=(
        "Reserve a ticket with 15-min lock "
        "and background reminder"
    ),
)
def reserve_ticket(
    data: ReservationRequest,
    background_tasks: BackgroundTasks,
    user_id: int = Depends(get_current_user_id),
):
    try:
        with get_db_cursor() as cursor:
            select_ticket_query = (
                "SELECT remaining_capacity FROM tickets "
                "WHERE ticket_id = %s "
                "FOR UPDATE;"
            )
            cursor.execute(select_ticket_query, (data.ticket_id,))
            ticket = cursor.fetchone()
            if not ticket:
                raise HTTPException(status_code=404, detail="Ticket not found")
            if ticket["remaining_capacity"] < 1:
                raise HTTPException(
                    status_code=400,
                    detail="Ticket is sold out",
                )

            reservation_check_query = (
                "SELECT reservation_id FROM reservations "
                "WHERE user_id = %s "
                "AND ticket_id = %s "
                "AND status IN ('pending', 'paid');"
            )
            cursor.execute(reservation_check_query, (user_id, data.ticket_id))
            if cursor.fetchone():
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "You already have an active reservation "
                        "for this ticket"
                    ),
                )

            update_ticket_query = (
                "UPDATE tickets "
                "SET remaining_capacity = remaining_capacity - 1 "
                "WHERE ticket_id = %s;"
            )
            cursor.execute(update_ticket_query, (data.ticket_id,))

            insert_reservation_query = (
                "INSERT INTO reservations "
                "(user_id, ticket_id, status, expires_at) "
                "VALUES (%s, %s, 'pending', "
                "NOW() + INTERVAL '15 minutes') "
                "RETURNING reservation_id, expires_at;"
            )
            cursor.execute(
                insert_reservation_query,
                (user_id, data.ticket_id),
            )
            reservation = cursor.fetchone()

            cursor.connection.commit()
            clear_ticket_cache()

            # 🔴 Executing the upgraded task in the background
            background_tasks.add_task(
                reservation_lifecycle_task,
                reservation["reservation_id"],
                user_id,
                data.ticket_id,
            )

            return {
                "reservation_id": reservation["reservation_id"],
                "ticket_id": data.ticket_id,
                "status": "pending",
                "message": "Ticket successfully reserved for 15 minutes.",
                "expires_at": reservation["expires_at"],
            }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}",
        )
