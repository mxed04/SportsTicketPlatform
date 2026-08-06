import logging
from app.core.celery_app import celery_app
from app.database import get_db_cursor
from app.redis_client import clear_ticket_cache

logger = logging.getLogger(__name__)


@celery_app.task(name="send_payment_reminder")
def send_payment_reminder_task(reservation_id: int, user_id: int):
    """13-minute reminder task"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                "SELECT status FROM reservations WHERE reservation_id = %s;",
                (reservation_id,),
            )
            result = cursor.fetchone()

            if result and result["status"] == "pending":
                logger.info(
                    "🔔 [REMINDER] User %s, only 2 minutes remain until your "
                    "ticket reservation (Reservation: %s) expires.",
                    user_id,
                    reservation_id,
                )
    except Exception as e:
        logger.error("Error in reminder task phase: %s", str(e))


@celery_app.task(name="cancel_expired_reservation")
def cancel_expired_reservation_task(
    reservation_id: int,
    user_id: int,
    ticket_id: int,
):
    """15-minute auto-cancellation task"""
    try:
        with get_db_cursor() as cursor:
            # Check if the reservation is still pending before cancelling
            select_reservation_status_query = (
                "SELECT status FROM reservations WHERE reservation_id = %s "
                "FOR UPDATE;"
            )
            cursor.execute(select_reservation_status_query, (reservation_id,))
            res = cursor.fetchone()

            if res and res["status"] == "pending":
                # Update the reservation status to 'cancelled'
                cursor.execute(
                    "UPDATE reservations SET status = 'cancelled' "
                    "WHERE reservation_id = %s;",
                    (reservation_id,),
                )

                # Update the ticket's remaining capacity
                update_ticket_capacity_query = (
                    "UPDATE tickets SET remaining_capacity = "
                    "remaining_capacity + 1 WHERE ticket_id = %s;"
                )
                cursor.execute(update_ticket_capacity_query, (ticket_id,))

                cursor.connection.commit()

                # Clear ticket cache after updating remaining capacity
                clear_ticket_cache()

                logger.info(
                    "🚫 [EXPIRED] Reservation %s for user %s expired "
                    "and was auto-cancelled.",
                    reservation_id,
                    user_id,
                )
    except Exception as e:
        logger.error("Error in auto-cancellation task phase: %s", str(e))
