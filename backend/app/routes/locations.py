import json
from fastapi import APIRouter, HTTPException, status
from app.database import get_db_cursor
from app.redis_client import redis_client

router = APIRouter(prefix="/api", tags=["Locations & Venues"])


@router.get(
    "/cities-venues",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="Get unique list of cities and venues (Redis Cached)",
)
def get_cities_and_venues():
    cache_key = "locations:cities_venues"

    # 🚀 REAL-WORLD FEATURE: Cache locations to reduce DB load
    cached_data = redis_client.get(cache_key)
    if cached_data:
        return json.loads(cached_data)

    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                SELECT DISTINCT city, venue_name
                FROM tickets
                WHERE match_date > NOW()
                ORDER BY city, venue_name;
                """
            )
            rows = cursor.fetchall()

            cities = list(set(row["city"] for row in rows if row["city"]))
            venues = list(set(row["venue_name"] for row in rows if
                              row["venue_name"]))

            result = {
                "cities": sorted(cities),
                "venues": sorted(venues),
            }
         
            # Cache for 1 hour
            redis_client.setex(cache_key, 3600, json.dumps(result))
            return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error:"
                            f" {str(e)}")
