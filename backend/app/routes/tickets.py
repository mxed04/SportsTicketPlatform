import json
import random
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
from app.es_client import es, INDEX_NAME

router = APIRouter(prefix="/api/tickets", tags=["Tickets"])


@router.get(
    "/search",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="ElasticSearch Ticket Search with Surge Pricing",
)
@limiter.limit("100/minute")
def search_tickets(
    request: Request,
    q: str | None = Query(None, description="General search query"),
    sport_type: str | None = Query(None, description="Sport type"),
    venue: str | None = Query(None, description="Venue name"),
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

        # 🚀 FIXED: Dynamic ES range handling for Surge Pricing (15%)
        if min_price is not None or max_price is not None:
            n_rng, s_rng = {}, {}
            if min_price is not None:
                n_rng["gte"] = min_price
                s_rng["gte"] = min_price / 1.15
            if max_price is not None:
                n_rng["lte"] = max_price
                s_rng["lte"] = max_price / 1.15

            must_clauses.append({
                "bool": {
                    "should": [
                        {
                            "bool": {
                                "must": [
                                    {"range": {
                                        "remaining_capacity": {"gte": 1000}
                                    }},
                                    {"range": {"price": n_rng}}
                                ]
                            }
                        },
                        {
                            "bool": {
                                "must": [
                                    {"range": {
                                        "remaining_capacity": {"lt": 1000}
                                    }},
                                    {"range": {"price": s_rng}}
                                ]
                            }
                        }
                    ],
                    "minimum_should_match": 1
                }
            })

        es_query = {
            "query": {"bool": {"must": must_clauses}},
            "sort": [{"match_date": {"order": "desc"}}],
            "size": 50,
        }

        res = es.search(index=INDEX_NAME, body=es_query)
        hits = res["hits"]["hits"]

        results = []
        for hit in hits:
            doc = hit["_source"]
            doc["ticket_id"] = hit.get("_id", doc.get("ticket_id"))

            bp = float(doc.get("price", 0))
            cap = int(doc.get("remaining_capacity", 0))

            if 0 < cap < 1000:
                doc["price"] = round(bp * 1.15, 2)
                doc["is_surge_pricing"] = True
            else:
                doc["price"] = bp
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
        cached = redis_client.get(cache_key)
        if cached:
            return {"ticket": json.loads(cached)}

        with get_db_cursor() as cursor:
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

            # Ensure English defaults
            home = item.get("home_team") or "Team A"
            away = item.get("away_team") or "Team B"
            item["title"] = f"{home} vs {away}"

            bp = float(item["price"])
            rem = int(item["remaining_capacity"])

            if 0 < rem < 1000:
                item["price"] = round(bp * 1.15, 2)
                item["is_surge_pricing"] = True
            else:
                item["price"] = bp
                item["is_surge_pricing"] = False

            v_key = f"ticket:{ticket_id}:viewers"
            redis_client.incr(v_key)
            redis_client.expire(v_key, 60)
            active_viewers = int(redis_client.get(v_key) or 1)

            item["active_viewers"] = (
                active_viewers * random.randint(2, 5)
                if active_viewers < 10
                else active_viewers
            )

            redis_client.setex(cache_key, 300, json.dumps(item))

            return {"ticket": item}

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
