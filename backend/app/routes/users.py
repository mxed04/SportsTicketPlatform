import io
import base64
import json
import qrcode
from fastapi import APIRouter, HTTPException, status, Depends
from app.schemas.users import UserProfileUpdate
from app.database import get_db_cursor
from app.routes.reservations import get_current_user_id
from app.redis_client import redis_client, invalidate_user_profile_cache

router = APIRouter(prefix="/api/user", tags=["User Profile"])


@router.get(
    "/profile",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="Get user profile data with Redis caching",
)
def get_user_profile(user_id: int = Depends(get_current_user_id)):
    cache_key = f"user:{user_id}:profile"
    cached = redis_client.get(cache_key)
    if cached:
        return {"user": json.loads(cached)}

    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                "SELECT first_name, last_name, phone_number, email, city "
                "FROM users WHERE user_id = %s;",
                (user_id,)
            )
            user = cursor.fetchone()
            if not user:
                raise HTTPException(
                    status_code=404, detail="User not found"
                )

            redis_client.setex(cache_key, 1200, json.dumps(user))
            return {"user": user}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/bookings",
    response_model=list[dict],
    status_code=status.HTTP_200_OK,
    summary="Get booking history and dynamically generate E-Tickets",
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
                       p.payment_id,
                       r.reserved_at,
                       r.expires_at  -- 🚀 FIXED: Added expires_at
                FROM reservations r
                JOIN tickets t ON r.ticket_id = t.ticket_id
                LEFT JOIN payments p ON r.reservation_id = p.reservation_id
                WHERE r.user_id = %s ORDER BY r.reserved_at DESC;
            """
            cursor.execute(query, (user_id,))
            rows = cursor.fetchall()

            results = []
            for r in rows:
                booking = {
                    "reservation_id": r["reservation_id"],
                    "ticket_id": r["ticket_id"],
                    "home_team": r["home_team"],
                    "away_team": r["away_team"],
                    "match_date": r["match_date"],
                    "reservation_status": r["reservation_status"],
                    "payment_status": r["payment_status"],
                    "amount_paid": float(r["amount_paid"])
                    if r["amount_paid"] else None,
                    "reserved_at": r["reserved_at"],
                    "expires_at": r["expires_at"],  # 🚀 FIXED
                    "qr_code": None,
                    "tracking_code": None,
                }

                if r["payment_status"] == "successful" and r["payment_id"]:
                    pid = r["payment_id"]
                    trk = f"TRK-{pid:06d}-BK"
                    booking["tracking_code"] = trk

                    td = {
                        "reservation_id": r["reservation_id"],
                        "ticket_id": r["ticket_id"],
                        "payment_id": pid,
                        "amount": float(r["amount_paid"]),
                        "tracking_code": trk,
                    }
                    qr = qrcode.QRCode(version=1, box_size=5, border=2)
                    qr.add_data(json.dumps(td))
                    qr.make(fit=True)
                    img = qr.make_image(
                        fill_color="black", back_color="white"
                    )
                    buf = io.BytesIO()
                    img.save(buf, format="PNG")
                    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
                    booking["qr_code"] = f"data:image/png;base64,{b64}"

                results.append(booking)
            return results

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
                    status_code=400, detail="No data to update"
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
                "message": "Profile updated successfully."
            }
    except Exception as e:
        detail = f"Database error: {e}"
        raise HTTPException(status_code=500, detail=detail)
