from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import settings
from app.database import get_db_cursor
from app.rate_limiter import limiter
from app.redis_client import check_redis_connection
from app.routes import (
    admin,
    auth,
    locations,
    payments,
    reports,
    reservations,
    tickets,
    users,
)

app = FastAPI(
    title=settings.APP_NAME,
    version="4.0.0",
    description=(
        "SportsTicketPlatform API - "
        "Phase 4 (Raw SQL, Redis & ElasticSearch)"
    ),
    # Prevents 307/308 redirects from breaking CORS preflight requests.
    redirect_slashes=False,
)

# Rate Limiter setup
app.state.limiter = limiter
app.add_exception_handler(
    RateLimitExceeded, _rate_limit_exceeded_handler
)

# 1. Add SlowAPIMiddleware first
app.add_middleware(SlowAPIMiddleware)

# 2. Add CORSMiddleware last so it becomes the OUTERMOST middleware
origins = [
    "http://localhost",
    "http://localhost:80",
    "http://localhost:3000",
    "http://localhost:5174",
    "http://localhost:8080",
    "http://127.0.0.1",
    "http://127.0.0.1:80",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:8080",
    "*",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth.router)
app.include_router(tickets.router)
app.include_router(reservations.router)
app.include_router(payments.router)
app.include_router(users.router)
app.include_router(reports.router)
app.include_router(admin.router)
app.include_router(locations.router)


# System Health Check
@app.get("/", tags=["System Health"])
def health_check():
    redis_status = check_redis_connection()

    db_status = False
    try:
        with get_db_cursor() as cursor:
            cursor.execute("SELECT 1 AS status;")
            result = cursor.fetchone()
            if result and result.get("status") == 1:
                db_status = True
    except Exception:
        db_status = False

    return {
        "status": "online",
        "app_name": settings.APP_NAME,
        "database_connected": db_status,
        "redis_connected": redis_status,
    }