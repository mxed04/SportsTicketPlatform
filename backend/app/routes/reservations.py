from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from app.schemas.reservations import ReservationRequest, ReservationResponse
from app.database import get_db_cursor
from app.config import settings
from app.redis_client import clear_ticket_cache
import logging

# 🔴 Importing Celery durable tasks
from app.tasks.reservation_tasks import (
    send_payment_reminder_task,
    cancel_expired_reservation_task,
)

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


@router.post(
    "/",
    response_model=ReservationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Reserve a ticket with 15-min lock (Durable Celery Tasks)",
)
def reserve_ticket(
    data: ReservationRequest,
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
                "WHERE user_id = %s AND ticket_id = %s "
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
            cursor.execute(insert_reservation_query, (user_id, data.ticket_id))
            reservation = cursor.fetchone()

            cursor.connection.commit()
            clear_ticket_cache()

            # 🔴 Executing Celery tasks (sending messages to Redis)

            # Task 1: Reminder after 13 minutes (780s)
            send_payment_reminder_task.apply_async(
                args=[reservation["reservation_id"], user_id],
                countdown=780,
            )

            # Task 2: Cancel after 15 minutes (900s)
            cancel_expired_reservation_task.apply_async(
                args=[
                    reservation["reservation_id"],
                    user_id,
                    data.ticket_id,
                ],
                countdown=900,
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
