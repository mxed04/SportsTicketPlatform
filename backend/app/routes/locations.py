from fastapi import APIRouter, HTTPException, status
from app.database import get_db_cursor

router = APIRouter(prefix="/api", tags=["Locations & Venues"])


@router.get(
    "/cities-venues",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="Get unique list of cities and venues",
)
def get_cities_and_venues():
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

            # 👈 Converting raw data to the standard Postman format
            cities = list(
                set(row["city"] for row in rows if row["city"])  # type: ignore
            )
            venues = list(
                set(
                    row["venue_name"] for row in rows if row["venue_name"]
                )
            )

            return {
                "cities": sorted(cities),
                "venues": sorted(venues),
            }
    except Exception as e:
        # keep line length under 79 characters for linters
        detail_msg = f"Database error: {str(e)}"
        raise HTTPException(status_code=500, detail=detail_msg)
