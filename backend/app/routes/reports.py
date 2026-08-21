from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    Request,
)
from app.schemas.reports import ReportCreate
from app.database import get_db_cursor
from app.routes.reservations import get_current_user_id
from app.rate_limiter import limiter

router = APIRouter(
    prefix="/api/reports",
    tags=["Reports & Support"],
)


@router.post(
    "",
    response_model=dict,  # Bypass strict schema validation
    status_code=status.HTTP_201_CREATED,
    summary="Submit a new support ticket/report",
)
@limiter.limit("3/minute")  # 🛡️ REAL-WORLD FEATURE: Anti-Spam Rate Limit
def create_report(
    request: Request,
    data: ReportCreate,
    user_id: int = Depends(get_current_user_id),
):
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO reports (
                    user_id,
                    ticket_id,
                    reservation_id,
                    category,
                    report_text,
                    status,
                    created_at
                )
                VALUES (%s, %s, %s, %s, %s, 'under_review', NOW())
                RETURNING
                    report_id,
                    user_id,
                    ticket_id,
                    reservation_id,
                    category,
                    report_text,
                    status,
                    created_at;
                """,
                (
                    user_id,
                    data.ticket_id,
                    data.reservation_id,
                    data.category,
                    data.report_text,
                ),
            )
            row = cursor.fetchone()
            cursor.connection.commit()
            return row

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}",
        )


# 🩺 FIXED: Changed "/" to "" to match POST route and prevent 405 error
@router.get(
    "",
    response_model=list[dict],  # Bypass strict schema for admin_response
    status_code=status.HTTP_200_OK,
    summary="Get all reports submitted by the current user",
)
def get_user_reports(user_id: int = Depends(get_current_user_id)):
    try:
        with get_db_cursor() as cursor:
            # Added admin_response to the SELECT query
            cursor.execute(
                """
                SELECT
                    report_id,
                    user_id,
                    ticket_id,
                    reservation_id,
                    category,
                    report_text,
                    admin_response,
                    status,
                    created_at
                FROM reports
                WHERE user_id = %s
                ORDER BY created_at DESC;
                """,
                (user_id,),
            )

            return cursor.fetchall()

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}",
        )
