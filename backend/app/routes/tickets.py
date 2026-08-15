# backend/app/routes/tickets.py
import json
from fastapi import (
    APIRouter,
    HTTPException,
    Query,
    Path,
    status,
    Request,
)
from app.database import get_db_cursor
from app.redis_client import redis_client
from app.schemas.tickets import TicketDetailResponse, TicketListResponse
from app.rate_limiter import limiter

# 🔴 Import Elasticsearch client
from app.es_client import es, INDEX_NAME

router = APIRouter(prefix="/api/tickets", tags=["Tickets"])


@router.get(
    "/search",
    response_model=TicketListResponse,
    status_code=status.HTTP_200_OK,
    summary="ElasticSearch Ticket Search with Surge Pricing",
)
@limiter.limit("20/minute")
def search_tickets(
    request: Request,
    sport_type: str | None = Query(None, description="Sport type"),
    venue: str | None = Query(None, description="Venue/stadium name"),
    min_price: float | None = Query(None, ge=0),
    max_price: float | None = Query(None, ge=0),
    team_name: str | None = Query(None, description="Team name"),
    ticket_tier: str | None = Query(None, description="Ticket tier"),
    start_date: str | None = Query(None, description="YYYY-MM-DD"),
):
    # 1. Check Redis Cache First
    cache_key = (
        f"es_tickets:{sport_type or 'all'}:{venue or 'all'}:"
        f"{min_price or '0'}:{max_price or 'inf'}:"
        f"{team_name or 'all'}:{ticket_tier or 'all'}:"
        f"{start_date or 'all'}"
    )
    cached_data = redis_client.get(cache_key)

    if cached_data:
        parsed = json.loads(cached_data)
        return {
            "source": "cache (Redis) ⚡",
            "count": parsed.get("count", 0),
            "tickets": parsed.get("tickets", []),
            "suggestions": parsed.get("suggestions", []),
        }

    try:
        # 2. Build Elasticsearch Query
        must_clauses = [{"term": {"is_active": True}}]
        should_clauses = []

        if sport_type:
            must_clauses.append({"term": {"sport_type": sport_type}})

        if ticket_tier:
            must_clauses.append({"match": {"ticket_tier": ticket_tier}})

        if start_date:
            must_clauses.append(
                {"range": {"match_date": {"gte": start_date}}}
            )

        if min_price is not None or max_price is not None:
            price_range = {}
            if min_price is not None:
                price_range["gte"] = min_price
            if max_price is not None:
                price_range["lte"] = max_price
            must_clauses.append({"range": {"price": price_range}})

        # Fuzzy and Edge-Ngram Search
        if venue:
            should_clauses.append(
                {
                    "match": {
                        "venue_name": {
                            "query": venue,
                            "fuzziness": "AUTO"
                        }
                    }
                }
            )

        if team_name:
            should_clauses.append(
                {
                    "multi_match": {
                        "query": team_name,
                        "fields": ["home_team", "away_team", "title"],
                        "fuzziness": "AUTO"
                    }
                }
            )

        es_query = {"bool": {"must": must_clauses}}
        if should_clauses:
            es_query["bool"]["should"] = should_clauses
            es_query["bool"]["minimum_should_match"] = 1

        # 3. Execute Search
        response = es.search(
            index=INDEX_NAME,
            query=es_query,
            size=50,
            sort=[{"match_date": {"order": "asc"}}]
        )

        hits = response["hits"]["hits"]
        tickets_list = []

        for hit in hits:
            item = hit["_source"]
            base_price = float(item["price"])
            remaining = int(item["remaining_capacity"])

            # 🔴 Dynamic Surge Pricing
            if 0 < remaining < 1000:
                item["price"] = round(base_price * 1.15, 2)
                item["is_surge_pricing"] = True
            else:
                item["price"] = base_price
                item["is_surge_pricing"] = False

            tickets_list.append(item)

        response_data = {
            "source": "ElasticSearch 🔎",
            "count": len(tickets_list),
            "tickets": tickets_list,
            "suggestions": [],
        }

        # Cache the ES response
        redis_client.set(cache_key, json.dumps(response_data), ex=60)
        return response_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/{ticket_id}",
    response_model=TicketDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get ticket details (SQL Joined)",
)
def get_ticket_details(
    ticket_id: int = Path(..., gt=0, description="Ticket ID")
):
    try:
        with get_db_cursor() as cursor:
            # SQL Query carefully wrapped to satisfy 79 chars limit
            query = """
            SELECT t.*,
                COALESCE(
                    f.league_name, v.league_name, b.league_name
                ) AS league_name,
                COALESCE(
                    f.stadium_name, v.hall_name, b.hall_name
                ) AS facility_name,
                COALESCE(
                    f.stand_section, v.seat_section, b.seat_section
                ) AS seat_section,
                COALESCE(
                    f.row_number, v.row_number, b.row_number
                ) AS row_number,
                COALESCE(
                    f.seat_number, v.seat_number, b.seat_number
                ) AS seat_number,
                COALESCE(
                    f.ticket_type, v.ticket_tier, b.ticket_tier
                ) AS specific_ticket_tier,
                COALESCE(
                    f.amenities, v.amenities, b.amenities
                ) AS amenities
            FROM tickets t
            LEFT JOIN football_details f ON t.ticket_id = f.ticket_id
            LEFT JOIN volleyball_details v ON t.ticket_id = v.ticket_id
            LEFT JOIN basketball_details b ON t.ticket_id = b.ticket_id
            WHERE t.ticket_id = %s;
            """
            cursor.execute(query, (ticket_id,))
            row = cursor.fetchone()

            if not row:
                raise HTTPException(
                    status_code=404, detail="Ticket not found"
                )

            item = dict(row)
            item["match_date"] = item["match_date"].isoformat()
            item["title"] = f"{item['home_team']} vs {item['away_team']}"

            base_price = float(item["price"])
            remaining = int(item["remaining_capacity"])

            if 0 < remaining < 1000:
                item["price"] = round(base_price * 1.15, 2)
                item["is_surge_pricing"] = True
            else:
                item["price"] = base_price
                item["is_surge_pricing"] = False

            return item

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))