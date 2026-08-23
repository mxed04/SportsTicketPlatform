import redis
from app.config import settings
import random

try:
    redis_client = redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        db=settings.REDIS_DB,
        decode_responses=True,
    )
    print("✅ Redis Client initialized successfully.")
except Exception as e:
    print(f"❌ Error initializing Redis: {e}")
    redis_client = None


def check_redis_connection():
    """Check the connection to the Redis server"""
    try:
        return redis_client.ping()
    except Exception:
        return False


def clear_ticket_cache():
    """Delete cached ticket search queries and details from Redis."""
    try:
        # Clear search cache
        for key in redis_client.scan_iter("tickets:search:*"):
            redis_client.delete(key)

        # 🚀 FIXED: Clear ticket details cache to instantly sync capacity UI
        for key in redis_client.scan_iter("ticket_detail:*"):
            redis_client.delete(key)
    except Exception as e:
        print(f"Redis cache clearing error: {e}")


def generate_and_set_otp(phone_number: str) -> str:
    """Generate a random 6-digit code and store it in Redis."""
    otp_code = str(random.randint(100000, 999999))
    redis_key = f"otp:{phone_number}"

    redis_client.setex(redis_key, 120, otp_code)
    return otp_code


def verify_otp(phone_number: str, user_otp: str) -> bool:
    """Verifying the entered code using Redis cache"""
    redis_key = f"otp:{phone_number}"
    stored_otp = redis_client.get(redis_key)

    if stored_otp and stored_otp == user_otp:
        redis_client.delete(redis_key)
        return True
    return False


def invalidate_user_profile_cache(user_id: int):
    """Clearing the user profile cache when editing information"""
    redis_key = f"user:profile:{user_id}"
    redis_client.delete(redis_key)


def add_to_waitlist(ticket_id: int, user_id: int) -> int:
    """Add a user to the waitlist and return their queue position."""
    queue_key = f"waitlist:{ticket_id}"

    existing_users = redis_client.lrange(queue_key, 0, -1)

    # 🚀 FIXED: Safer string matching for decode_responses=True
    if str(user_id) in existing_users:
        return -1

    redis_client.rpush(queue_key, user_id)
    return redis_client.llen(queue_key)


def pop_from_waitlist(ticket_id: int):
    """Removes and returns the first user in the waitlist (Left Pop)."""
    queue_key = f"waitlist:{ticket_id}"
    user_id = redis_client.lpop(queue_key)
    return int(user_id) if user_id else None
