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
@limiter.limit("100/minute")
def search_tickets(
    request: Request,
    q: str | None = Query(None, description="General search query"),
    sport_type: str | None = Query(None, description="Sport type"),
    venue: str | None = Query(None, description="Venue/stadium name"),
    min_price: float | None = Query(None, ge=0),
    max_price: float | None = Query(None, ge=0),
):
    try:
        must_clauses = [{"match": {"is_active": True}}]

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
                    "fuzziness": "AUTO",
                }
            })

        if sport_type and sport_type.lower() != "all":
            must_clauses.append({
                "term": {"sport_type": sport_type.lower()}
            })

        if venue and venue.strip():
            must_clauses.append({
                "match": {
                    "venue_name": {
                        "query": venue.strip(),
                        "fuzziness": "AUTO",
                    }
                }
            })

        if min_price is not None or max_price is not None:
            price_range = {}
            if min_price is not None:
                price_range["gte"] = min_price
            if max_price is not None:
                price_range["lte"] = max_price
            must_clauses.append({"range": {"price": price_range}})

        es_query = {
            "query": {"bool": {"must": must_clauses}},
            "sort": [{"match_date": {"order": "desc"}}],
            "size": 50,
        }

        response = es.search(index=INDEX_NAME, body=es_query)
        hits = response["hits"]["hits"]

        results = []
        for hit in hits:
            doc = hit["_source"]
            doc["ticket_id"] = hit.get("_id", doc.get("ticket_id"))
            
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
    cache_key = f"ticket_detail:{ticket_id}"
    try:
        cached_data = redis_client.get(cache_key)
        if cached_data:
            return {"ticket": json.loads(cached_data)}
            
        with get_db_cursor() as cursor:
            # FIX: Simplified query based on Phase 2 schema optimization!
            query = """
            SELECT ticket_id, home_team, away_team, match_date, 
                   sport_type, price, remaining_capacity, 
                   is_active, venue_name
            FROM tickets
            WHERE ticket_id = %s;
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
            
            # Reconstruct title directly
            home = item.get("home_team") or "تیم ۱"
            away = item.get("away_team") or "تیم ۲"
            item["title"] = f"{home} vs {away}"

            base_price = float(item["price"])
            remaining = int(item["remaining_capacity"])

            if 0 < remaining < 1000:
                item["price"] = round(base_price * 1.15, 2)
                item["is_surge_pricing"] = True
            else:
                item["price"] = base_price
                item["is_surge_pricing"] = False

            redis_client.setex(cache_key, 300, json.dumps(item))
            
            return {"ticket": item}

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))