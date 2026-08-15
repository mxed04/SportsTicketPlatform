from fastapi import APIRouter, HTTPException, status, Depends
from app.schemas.users import BookingResponse, UserProfileUpdate
from app.database import get_db_cursor
from app.routes.reservations import get_current_user_id
from app.redis_client import invalidate_user_profile_cache

router = APIRouter(prefix="/api/user", tags=["User Profile"])


@router.get(
    "/bookings",
    response_model=list[BookingResponse],
    status_code=status.HTTP_200_OK,
    summary="Get booking history for the current user",
)
def get_user_bookings(user_id: int = Depends(get_current_user_id)):
    try:
        with get_db_cursor() as cursor:
            query = """
                SELECT r.reservation_id, r.ticket_id, t.home_team,
                       t.away_team, t.match_date,
                       r.status AS reservation_status,
                       p.status AS payment_status,
                       p.amount AS amount_paid,
                       r.reserved_at
                FROM reservations r
                JOIN tickets t ON r.ticket_id = t.ticket_id
                LEFT JOIN payments p ON r.reservation_id = p.reservation_id
                WHERE r.user_id = %s ORDER BY r.reserved_at DESC;
            """
            cursor.execute(query, (user_id,))
            return [
                {
                    "reservation_id": r["reservation_id"],
                    "ticket_id": r["ticket_id"],
                    "home_team": r["home_team"],
                    "away_team": r["away_team"],
                    "match_date": r["match_date"],
                    "reservation_status": r["reservation_status"],
                    "payment_status": r["payment_status"],
                    "amount_paid": (
                        float(r["amount_paid"]) if r["amount_paid"] else None
                    ),
                    "reserved_at": r["reserved_at"],
                }
                for r in cursor.fetchall()
            ]
    except Exception as e:
        detail = f"Database error: {e}"
        raise HTTPException(status_code=500, detail=detail)


@router.put(
    "/profile",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="Update user profile and invalidate cache",
)
def update_profile(
    data: UserProfileUpdate,
    user_id: int = Depends(get_current_user_id),
):
    try:
        with get_db_cursor() as cursor:
            updates, params = [], []
            if data.first_name:
                updates.append("first_name = %s")
                params.append(data.first_name)
            if data.last_name:
                updates.append("last_name = %s")
                params.append(data.last_name)
            if data.city:
                updates.append("city = %s")
                params.append(data.city)

            if not updates:
                raise HTTPException(
                    status_code=400, detail="No data provided to update"
                )

            params.append(user_id)
            cursor.execute(
                "UPDATE users SET "
                f"{', '.join(updates)} WHERE user_id = %s",
                tuple(params),
            )
            cursor.connection.commit()
            invalidate_user_profile_cache(user_id)
            return {
                "message": "Profile updated successfully. Cache invalidated."
            }
    except Exception as e:
        detail = f"Database error: {e}"
        raise HTTPException(status_code=500, detail=detail)
