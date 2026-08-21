from fastapi import APIRouter, Depends, HTTPException, status
from app.database import get_db_cursor
from app.routes.reservations import get_current_user_id

from app.schemas.admin import (
    AdminManageRequest,
    AdminReportReplyRequest,
    DashboardStatsResponse,
)

router = APIRouter(prefix="/api/admin", tags=["Admin Dashboard"])


def verify_admin_or_support_role(
    user_id: int = Depends(get_current_user_id),
) -> int:
    """Verifies if the current user holds admin or support privileges."""
    with get_db_cursor() as cursor:
        cursor.execute(
            "SELECT role FROM users WHERE user_id = %s;",
            (user_id,),
        )
        user = cursor.fetchone()
        if not user or user["role"] not in ("admin", "support"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Admin or Support role required.",
            )
    return user_id


@router.get(
    "/dashboard-stats",
    response_model=DashboardStatsResponse,
    status_code=status.HTTP_200_OK,
)
def get_dashboard_stats(
    user_id: int = Depends(verify_admin_or_support_role),
):
    """
    Fetches high-level analytics for the admin dashboard.
    Utilizes the Materialized View for O(1) read performance.
    """
    try:
        with get_db_cursor() as cursor:
            # 1. Refresh the materialized view concurrently (No table locks)
            cursor.execute("SELECT refresh_admin_dashboard_mview();")

            # 2. Fetch the pre-calculated aggregated statistics
            cursor.execute(
                "SELECT total_revenue, total_tickets_sold, "
                "total_cancellations, pending_reports "
                "FROM admin_dashboard_mview;"
            )
            stats = cursor.fetchone()

            # Fallback to 0 if the view is completely empty
            if not stats:
                return {
                    "total_revenue": 0.0,
                    "total_tickets_sold": 0,
                    "total_cancellations": 0,
                    "pending_reports": 0,
                }

            return {
                "total_revenue": float(stats["total_revenue"] or 0),
                "total_tickets_sold": stats["total_tickets_sold"] or 0,
                "total_cancellations": stats["total_cancellations"] or 0,
                "pending_reports": stats["pending_reports"] or 0,
            }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.get(
    "/reports",
    response_model=list[dict],  # Bypass strict schema for NULL responses
    status_code=status.HTTP_200_OK,
)
def get_all_reports_for_admin(
    user_id: int = Depends(verify_admin_or_support_role),
):
    """Retrieves all support reports with user details for admins."""
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    r.report_id,
                    r.user_id,
                    u.first_name || ' ' || u.last_name AS user_name,
                    r.ticket_id,
                    r.reservation_id,
                    r.category,
                    r.report_text,
                    r.admin_response,
                    r.status,
                    r.created_at
                FROM reports r
                LEFT JOIN users u ON r.user_id = u.user_id
                ORDER BY r.created_at DESC;
                """
            )
            return cursor.fetchall()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.put(
    "/reports/{report_id}/reply",
    status_code=status.HTTP_200_OK,
)
def reply_to_report(
    report_id: int,
    data: AdminReportReplyRequest,
    user_id: int = Depends(verify_admin_or_support_role),
):
    """Allows admin/support to reply to a user's report."""
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                UPDATE reports
                SET admin_response = %s, status = %s
                WHERE report_id = %s
                RETURNING report_id;
                """,
                (data.admin_response, data.status, report_id),
            )
            updated = cursor.fetchone()
            if not updated:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Ticket not found.",
                )
            cursor.connection.commit()
            return {"message": "Admin reply registered successfully."}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.put(
    "/manage",
    status_code=status.HTTP_200_OK,
)
def manage_entity(
    data: AdminManageRequest,
    user_id: int = Depends(verify_admin_or_support_role),
):
    """General endpoint for admins to manually override statuses."""
    if data.entity_type == "report":
        valid_statuses = ["under_review", "resolved", "closed"]
        if data.new_status not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid report status: {data.new_status}",
            )
    else:
        valid_statuses = ["pending", "paid", "cancelled"]
        if data.new_status not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid reservation status: {data.new_status}",
            )

    try:
        with get_db_cursor() as cursor:
            if data.entity_type == "report":
                sql = (
                    "UPDATE reports SET status = %s "
                    "WHERE report_id = %s RETURNING report_id;"
                )
            else:
                sql = (
                    "UPDATE reservations SET status = %s "
                    "WHERE reservation_id = %s RETURNING reservation_id;"
                )

            cursor.execute(sql, (data.new_status, data.entity_id))

            if not cursor.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"{data.entity_type} not found in database.",
                )

            cursor.connection.commit()
            return {"message": "Status updated successfully."}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.get(
    "/users",
    status_code=status.HTTP_200_OK,
    summary="Get list of all users for admin dashboard",
)
def get_all_users(
    user_id: int = Depends(verify_admin_or_support_role),
):
    """Retrieves all registered users for administrative viewing."""
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                "SELECT user_id, first_name, last_name, phone_number, "
                "email, role, city, is_active, created_at "
                "FROM users ORDER BY created_at DESC;"
            )
            return cursor.fetchall()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get(
    "/tickets",
    status_code=status.HTTP_200_OK,
    summary="Get list of all tickets for admin dashboard",
)
def get_all_tickets_admin(
    user_id: int = Depends(verify_admin_or_support_role),
):
    """Retrieves all sports events and tickets for admin viewing."""
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                "SELECT ticket_id, home_team, away_team, sport_type, "
                "match_date, price, remaining_capacity, is_active "
                "FROM tickets ORDER BY match_date DESC;"
            )
            return cursor.fetchall()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
