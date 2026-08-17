# backend/app/sync_es.py
import logging
from app.database import get_db_cursor
from app.es_client import init_elasticsearch, es, INDEX_NAME

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def sync_all_tickets_to_es():
    """
    Fetches all tickets directly from the main tickets table
    and bulk indexes them into ElasticSearch.
    """
    logger.info("🚀 Starting full synchronization from SQL to ElasticSearch...")
    init_elasticsearch()

    try:
        with get_db_cursor() as cursor:
            # No need for complex JOINs! The schema was optimized in Phase 2.
            query = """
            SELECT ticket_id, home_team, away_team, match_date, 
                   sport_type, price, remaining_capacity, is_active,
                   venue_name
            FROM tickets;
            """
            cursor.execute(query)
            rows = cursor.fetchall()

            if not rows:
                logger.warning("⚠️ No tickets found in SQL database.")
                return

            count = 0
            for row in rows:
                doc = dict(row)
                
                # Format date
                if doc.get("match_date"):
                    doc["match_date"] = doc["match_date"].isoformat()
                
                # Create dynamic title for ElasticSearch
                home = doc.get('home_team') or 'Team A'
                away = doc.get('away_team') or 'Team B'
                doc["title"] = f"{home} vs {away}"
                
                # Index into ES
                es.index(
                    index=INDEX_NAME, 
                    id=str(doc["ticket_id"]), 
                    document=doc
                )
                count += 1

            logger.info(
                f"✅ Successfully synced {count} tickets to ElasticSearch!"
            )

    except Exception as e:
        logger.error(f"❌ Synchronization failed: {e}")


if __name__ == "__main__":
    sync_all_tickets_to_es()