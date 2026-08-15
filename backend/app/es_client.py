import os
import logging
from elasticsearch import Elasticsearch

logger = logging.getLogger(__name__)

# Getting the Elastic IP address from the .env file
ELASTICSEARCH_URL = os.getenv(
    "ELASTICSEARCH_URL", "http://elasticsearch:9200"
)

# Creating the main Elasticsearch client
es = Elasticsearch(ELASTICSEARCH_URL)

INDEX_NAME = "tickets"


def init_elasticsearch():
    """
    Checking for the existence of the index and creating it with
    Autocomplete-related settings.
    """
    try:
        if not es.indices.exists(index=INDEX_NAME):
            # Edge N-Gram settings for fragmenting words as user types
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

            # Mapping (Structure) for the ticket data
            mappings = {
                "properties": {
                    "ticket_id": {"type": "integer"},
                    "title": {
                        "type": "text",
                        "analyzer": "autocomplete_analyzer",
                        "search_analyzer": "autocomplete_search_analyzer",
                    },
                    "sport_type": {"type": "keyword"},
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
                    "venue_name": {
                        "type": "text",
                        "analyzer": "autocomplete_analyzer",
                        "search_analyzer": "autocomplete_search_analyzer",
                    },
                    "city": {"type": "keyword"},
                    "ticket_tier": {"type": "keyword"},
                    "organizer": {"type": "text"},
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
            logger.info(
                f"✅ Elasticsearch index '{INDEX_NAME}' "
                "created successfully."
            )
        else:
            logger.info(
                f"⚡ Elasticsearch index '{INDEX_NAME}' "
                "already exists."
            )
    except Exception as e:
        logger.error(
            f"❌ Failed to connect/initialize Elasticsearch: {e}"
        )


def update_ticket_capacity_in_es(ticket_id: int, new_capacity: int):
    """
    Update ticket remaining capacity in ElasticSearch in real-time.
    """
    try:
        es.update(
            index=INDEX_NAME,
            id=str(ticket_id),
            doc={"remaining_capacity": new_capacity}
        )
        logger.info(
            f"🔄 ES Sync: Ticket {ticket_id} capacity -> {new_capacity}"
        )
    except Exception as e:
        logger.error(
            f"❌ ES Sync failed for ticket {ticket_id}: {e}"
        )