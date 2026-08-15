from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from app.schemas.reports import ReportCreate, ReportResponse
from app.database import get_db_cursor
from app.routes.reservations import get_current_user_id

router = APIRouter(
    prefix="/api/reports",
    tags=["Reports & Support"],
)


@router.post(
    "/",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a new support ticket/report",
)
def create_report(
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


@router.get(
    "/",
    response_model=list[ReportResponse],
    status_code=status.HTTP_200_OK,
    summary="Get all reports submitted by the current user",
)
def get_user_reports(user_id: int = Depends(get_current_user_id)):
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    report_id,
                    user_id,
                    ticket_id,
                    reservation_id,
                    category,
                    report_text,
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
