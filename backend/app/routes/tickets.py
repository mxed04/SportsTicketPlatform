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
from app.rate_limiter import limiter

# Import Elasticsearch client
from app.es_client import es, INDEX_NAME

router = APIRouter(prefix="/api/tickets", tags=["Tickets"])


@router.get(
    "/search",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="ElasticSearch Ticket Search with Surge Pricing & Fuzzy Match",
)
@limiter.limit("100/minute")  # Increased limit to prevent 429 on rapid typing
def search_tickets(
    request: Request,
    q: str | None = Query(None, description="General search query"),
    sport_type: str | None = Query(None, description="Sport type"),
    venue: str | None = Query(None, description="Venue/stadium name"),
    min_price: float | None = Query(None, ge=0),
    max_price: float | None = Query(None, ge=0),
):
    """
    Advanced search endpoint using ElasticSearch.
    Supports fuzzy matching, autocomplete, and exact filtering.
    """
    try:
        # Base condition: Only show active tickets
        must_clauses = [{"match": {"is_active": True}}]

        # 1. General Fuzzy Search (Autocomplete + Typo Tolerance)
        if q and q.strip():
            must_clauses.append({
                "multi_match": {
                    "query": q.strip(),
                    "fields": [
                        "home_team^3",
                        "away_team^3",
                        "title^2",
                        "venue_name",
                    ],
                    "fuzziness": "AUTO",  # The magic of typo tolerance!
                }
            })

        # 2. Sport Type Exact Filter
        if sport_type and sport_type.lower() != "all":
            must_clauses.append({
                "term": {"sport_type": sport_type.lower()}
            })

        # 3. Venue Fuzzy Filter
        if venue and venue.strip():
            must_clauses.append({
                "match": {
                    "venue_name": {
                        "query": venue.strip(),
                        "fuzziness": "AUTO",
                    }
                }
            })

        # 4. Price Range Filters
        if min_price is not None or max_price is not None:
            price_range = {}
            if min_price is not None:
                price_range["gte"] = min_price
            if max_price is not None:
                price_range["lte"] = max_price
            must_clauses.append({"range": {"price": price_range}})

        # Build final ES query
        es_query = {
            "query": {"bool": {"must": must_clauses}},
            "sort": [{"match_date": {"order": "desc"}}],
            "size": 50,  # Limit results
        }

        response = es.search(index=INDEX_NAME, body=es_query)
        hits = response["hits"]["hits"]

        results = []
        for hit in hits:
            doc = hit["_source"]
            doc["ticket_id"] = hit.get("_id", doc.get("ticket_id"))
   
            # Apply dynamic surge pricing logic (15% if capacity < 1000)
            base_price = float(doc.get("price", 0))
            cap = int(doc.get("remaining_capacity", 0))
            
            if 0 < cap < 1000:
                doc["price"] = round(base_price * 1.15, 2)
                doc["is_surge_pricing"] = True
            else:
                doc["price"] = base_price
                doc["is_surge_pricing"] = False

            results.append(doc)

        return {"tickets": results}

    except Exception as e:
        # Fallback to empty list if ES fails to prevent API crashing
        print(f"ElasticSearch Search Error: {e}")
        return {"tickets": []}


@router.get(
    "/{ticket_id}",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("60/minute")
def get_ticket_detail(
    request: Request,
    ticket_id: int = Path(..., description="Ticket ID", gt=0),
):
    """
    Fetch exact ticket details from PostgreSQL (Source of Truth).
    """
    cache_key = f"ticket_detail:{ticket_id}"
    try:
        cached_data = redis_client.get(cache_key)
        if cached_data:
            return {"ticket": json.loads(cached_data)}
            
        with get_db_cursor() as cursor:
            query = """
            SELECT t.ticket_id, t.home_team, t.away_team, t.match_date, 
                   t.sport_type, t.price, t.remaining_capacity, 
                   t.is_active,
                COALESCE(
                    f.stadium_name, v.stadium_name, b.arena_name
                ) AS venue_name,
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
            if item.get("match_date"):
                item["match_date"] = item["match_date"].isoformat()
            
            item["title"] = f"{item['home_team']} vs {item['away_team']}"

            base_price = float(item["price"])
            remaining = int(item["remaining_capacity"])

            # Surge Pricing calculation
            if 0 < remaining < 1000:
                item["price"] = round(base_price * 1.15, 2)
                item["is_surge_pricing"] = True
            else:
                item["price"] = base_price
                item["is_surge_pricing"] = False

            # Cache the result for 5 minutes
            redis_client.setex(cache_key, 300, json.dumps(item))
            
            return {"ticket": item}

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))