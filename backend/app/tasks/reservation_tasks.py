import logging
from app.core.celery_app import celery_app
from app.database import get_db_cursor
from app.redis_client import clear_ticket_cache, pop_from_waitlist
from app.es_client import update_ticket_capacity_in_es

logger = logging.getLogger(__name__)


@celery_app.task(name="send_payment_reminder")
def send_payment_reminder_task(reservation_id: int, user_id: int):
    """13-minute reminder task"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                "SELECT status FROM reservations "
                "WHERE reservation_id = %s;",
                (reservation_id,),
            )
            result = cursor.fetchone()

            if result and result["status"] == "pending":
                logger.info(
                    "🔔 [REMINDER] User %s, 2 minutes remaining "
                    "for reservation %s.",
                    user_id,
                    reservation_id,
                )
    except Exception as e:
        logger.error("Reminder error: %s", str(e))


@celery_app.task(name="cancel_expired_reservation")
def cancel_expired_reservation_task(
    reservation_id: int,
    user_id: int,
    ticket_id: int,
):
    """15-minute auto-cancellation and waitlist progression"""
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                "SELECT status FROM reservations "
                "WHERE reservation_id = %s FOR UPDATE;",
                (reservation_id,)
            )
            res = cursor.fetchone()

            if res and res["status"] == "pending":
                # 1. Cancel the expired reservation
                cursor.execute(
                    "UPDATE reservations SET status = 'cancelled' "
                    "WHERE reservation_id = %s;",
                    (reservation_id,),
                )

                # 2. Check waitlist BEFORE restoring capacity
                next_user_id = None
                try:
                    next_user_id = pop_from_waitlist(ticket_id)
                except Exception as wl_err:
                    logger.error("Waitlist pop error: %s", str(wl_err))

                if next_user_id:
                    # 🚀 WAITLIST LOGIC: Auto-assign ticket to the next user
                    cursor.execute(
                        "INSERT INTO reservations "
                        "(user_id, ticket_id, status, expires_at) "
                        "VALUES (%s, %s, 'pending', "
                        "NOW() + INTERVAL '15 minutes') "
                        "RETURNING reservation_id;",
                        (next_user_id, ticket_id)
                    )
                    new_res = cursor.fetchone()
                    new_res_id = new_res["reservation_id"]

                    cursor.connection.commit()

                    logger.info(
                        "🔄 [AUTO-ASSIGNED] Res %s expired. Ticket %s "
                        "is now locked for Waitlist User %s (New Res: %s).",
                        reservation_id, ticket_id, next_user_id, new_res_id
                    )

                    # Fire off NEW Celery timers for the newly assigned user
                    send_payment_reminder_task.apply_async(
                        args=[new_res_id, next_user_id], countdown=780
                    )
                    cancel_expired_reservation_task.apply_async(
                        args=[new_res_id, next_user_id, ticket_id],
                        countdown=900
                    )

                else:
                    # 🔓 NO WAITLIST: Safely restore capacity and unlock
                    cursor.execute(
                        "UPDATE tickets SET remaining_capacity = "
                        "remaining_capacity + 1 WHERE ticket_id = %s "
                        "RETURNING remaining_capacity;",
                        (ticket_id,)
                    )
                    new_cap_row = cursor.fetchone()
                    new_cap = (
                        new_cap_row["remaining_capacity"]
                        if new_cap_row else 0
                    )

                    cursor.connection.commit()

                    logger.info(
                        "🚫 [EXPIRED] Res %s cancelled. "
                        "Cap restored to %s.",
                        reservation_id,
                        new_cap
                    )

                    try:
                        update_ticket_capacity_in_es(ticket_id, new_cap)
                    except Exception as es_err:
                        logger.error("ES Sync error: %s", str(es_err))

                # Clear cache in all scenarios to update UI for all users
                try:
                    clear_ticket_cache()
                except Exception as c_err:
                    logger.error("Cache flush error: %s", str(c_err))

    except Exception as e:
        logger.error("Auto-cancellation critical error: %s", str(e))
