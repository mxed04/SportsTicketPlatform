from app.database import get_db_cursor
from app.es_client import es, INDEX_NAME, init_elasticsearch
from elasticsearch.helpers import bulk


def sync_tickets_to_es():
    print("⏳ Initializing Elasticsearch Index...")
    init_elasticsearch()

    print("⏳ Starting bulk sync from PostgreSQL to Elasticsearch...")
    try:
        with get_db_cursor() as cursor:
            cursor.execute("""
                SELECT ticket_id, sport_type, home_team, away_team,
                       venue_name, city, ticket_tier, organizer,
                       match_date, price, remaining_capacity, is_active
                FROM tickets;
            """)
            rows = cursor.fetchall()

        actions = []
        for row in rows:
            item = dict(row)
            item["match_date"] = item["match_date"].isoformat()
            item["title"] = f"{item['home_team']} vs {item['away_team']}"

            # Convert to standard Elasticsearch format
            action = {
                "_index": INDEX_NAME,
                "_id": item["ticket_id"],  # Shared ID between SQL and Elastic
                "_source": item,
            }
            actions.append(action)

        if actions:
            success, _ = bulk(es, actions)
            print(f"✅ Successfully synced {success} tickets to Elasticsearch!")
        else:
            print("⚠️ No tickets found in PostgreSQL to sync.")

    except Exception as e:
        print(f"❌ Sync failed: {e}")


if __name__ == "__main__":
    sync_tickets_to_es()
