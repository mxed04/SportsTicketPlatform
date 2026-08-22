import os
import logging
from elasticsearch import Elasticsearch

logger = logging.getLogger(__name__)

ELASTICSEARCH_URL = os.getenv(
    "ELASTICSEARCH_URL", "http://elasticsearch:9200"
)

es = Elasticsearch(ELASTICSEARCH_URL)

INDEX_NAME = "tickets"


def init_elasticsearch():
    """
    Initialize the Elasticsearch index with proper settings and
    mappings for fuzzy search and autocomplete.
    """
    try:
        if not es.indices.exists(index=INDEX_NAME):
            settings = {
                "analysis": {
                    "analyzer": {
                        "autocomplete_analyzer": {
                            "tokenizer": "autocomplete_tokenizer",
                            "filter": ["lowercase"],
                        },
                        "autocomplete_search_analyzer": {
                            "tokenizer": "standard",
                            "filter": ["lowercase"],
                        },
                    },
                    "tokenizer": {
                        "autocomplete_tokenizer": {
                            "type": "edge_ngram",
                            "min_gram": 2,
                            "max_gram": 20,
                            "token_chars": ["letter", "digit"],
                        }
                    },
                }
            }

            mappings = {
                "properties": {
                    "ticket_id": {"type": "integer"},
                    "home_team": {
                        "type": "text",
                        "analyzer": "autocomplete_analyzer",
                        "search_analyzer": "autocomplete_search_analyzer",
                    },
                    "away_team": {
                        "type": "text",
                        "analyzer": "autocomplete_analyzer",
                        "search_analyzer": "autocomplete_search_analyzer",
                    },
                    "title": {
                        "type": "text",
                        "analyzer": "autocomplete_analyzer",
                        "search_analyzer": "autocomplete_search_analyzer",
                    },
                    "venue_name": {
                        "type": "text",
                        "analyzer": "autocomplete_analyzer",
                        "search_analyzer": "autocomplete_search_analyzer",
                    },
                    "sport_type": {"type": "keyword"},
                    "match_date": {"type": "date"},
                    "price": {"type": "double"},
                    "remaining_capacity": {"type": "integer"},
                    "is_active": {"type": "boolean"},
                }
            }

            es.indices.create(
                index=INDEX_NAME,
                settings=settings,
                mappings=mappings,
            )
            logger.info(f"✅ ES Index '{INDEX_NAME}' created successfully.")
        else:
            logger.info(f"⚡ ES Index '{INDEX_NAME}' already exists.")
    except Exception as e:
        logger.error(f"❌ ES Initialization failed: {e}")


def index_ticket_in_es(ticket_id: int, ticket_data: dict):
    """
    Index or update a full ticket document in Elasticsearch.
    """
    try:
        es.index(index=INDEX_NAME, id=str(ticket_id), document=ticket_data)
        logger.info(f"🔄 ES Sync: Ticket {ticket_id} indexed.")
    except Exception as e:
        logger.error(f"❌ ES Sync failed for ticket {ticket_id}: {e}")


def update_ticket_capacity_in_es(ticket_id: int, new_capacity: int):
    """
    Real-time update of ticket remaining capacity in ElasticSearch.
    """
    try:
        es.update(
            index=INDEX_NAME,
            id=str(ticket_id),
            doc={"remaining_capacity": new_capacity},
        )
        logger.info(f"🔄 ES Sync: Ticket {ticket_id} cap -> {new_capacity}")
    except Exception as e:
        logger.error(f"❌ ES Capacity Sync failed for ticket {ticket_id}: {e}")


def delete_ticket_in_es(ticket_id: int):
    """
    Remove a ticket from Elasticsearch.
    """
    try:
        # Ignore 404 if it's already deleted
        es.delete(index=INDEX_NAME, id=str(ticket_id), ignore_status=[404])
        logger.info(f"🗑️ ES Sync: Ticket {ticket_id} deleted.")
    except Exception as e:
        logger.error(f"❌ ES Deletion failed for ticket {ticket_id}: {e}")
