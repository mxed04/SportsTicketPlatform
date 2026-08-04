from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.redis_client import check_redis_connection
from app.database import get_db_cursor
from app.routes import (
    auth,
    tickets,
    reservations,
    payments,
    users,
    reports,
    admin,
    locations,
)

app = FastAPI(
    title=settings.APP_NAME,
    version="3.0.0",
    description="SportsTicketPlatform API - Phase 3 (Raw SQL & Redis Cache)",
)

# 🔴 Fixing CORS settings for frontend communication
origins = [
    "http://localhost:3000",  # React / Next.js
    "http://127.0.0.1:3000",
    "http://localhost:5173",  # Vite (Vue/React)
    "http://127.0.0.1:5173",
    "http://localhost:8080",  # Vue CLI
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Allow only specified origins for security
    allow_credentials=True,  # Allow sending cookies and authentication tokens
    allow_methods=[
        "*"
    ],  # Allow executing all methods (GET, POST, PUT, DELETE, OPTIONS)
    allow_headers=["*"],  # Allow receiving all custom headers
)

app.include_router(auth.router)
app.include_router(tickets.router)
app.include_router(reservations.router)
app.include_router(payments.router)
app.include_router(users.router)
app.include_router(reports.router)
app.include_router(admin.router)
app.include_router(locations.router)


# System Health tag to exit default mode
@app.get("/", tags=["System Health"])
def health_check():
    # Checking Redis Connection
    redis_status = check_redis_connection()

    # Checking PostgreSQL Connection with Raw Query
    db_status = False
    try:
        with get_db_cursor() as cursor:
            cursor.execute("SELECT 1 AS status;")
            result = cursor.fetchone()
            if result and result["status"] == 1:
                db_status = True
    except Exception as e:
        print(f"DB Check Error: {e}")

    return {
        "app_name": settings.APP_NAME,
        "database_connected": db_status,
        "redis_connected": redis_status,
        "orm_used": False,
        "message": "Welcome to SportsTicketPlatform Backend!",
    }
