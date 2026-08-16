from fastapi import APIRouter, Depends, HTTPException, status
from app.database import get_db_cursor
from app.routes.reservations import get_current_user_id
from app.schemas.admin import (
    AdminManageRequest,
    AdminReportReplyRequest,
    AdminReportResponse,
    DashboardStatsResponse,
)

router = APIRouter(prefix="/api/admin", tags=["Admin Dashboard"])


def verify_admin_or_support_role(
    user_id: int = Depends(get_current_user_id),
) -> int:
    """
    Access level validation: Only users with 'admin' or 'support' role
    are permitted. Otherwise, returns a 403 Forbidden HTTP exception.
    """
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
    summary="Get aggregated statistics for the admin dashboard",
)
def get_dashboard_stats(
    user_id: int = Depends(verify_admin_or_support_role),
):
    try:
        with get_db_cursor() as cursor:
            # Query total revenue
            cursor.execute(
                "SELECT COALESCE(SUM(amount), 0) AS total_revenue "
                "FROM payments WHERE status = 'completed';"
            )
            revenue = cursor.fetchone()["total_revenue"]

            # Query total confirmed ticket sales
            cursor.execute(
                "SELECT COUNT(*) AS total_tickets_sold "
                "FROM reservations WHERE status = 'confirmed';"
            )
            tickets_sold = cursor.fetchone()["total_tickets_sold"]

            # Query total cancellations
            cursor.execute(
                "SELECT COUNT(*) AS total_cancellations "
                "FROM reservations WHERE status = 'cancelled';"
            )
            cancellations = cursor.fetchone()["total_cancellations"]

            # Query pending support reports
            cursor.execute(
                "SELECT COUNT(*) AS pending_reports FROM reports "
                "WHERE status IN ('under_review', 'pending');"
            )
            pending_reports = cursor.fetchone()["pending_reports"]

            return {
                "total_revenue": float(revenue),
                "total_tickets_sold": tickets_sold,
                "total_cancellations": cancellations,
                "pending_reports": pending_reports,
            }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.get(
    "/reports",
    response_model=list[AdminReportResponse],
    status_code=status.HTTP_200_OK,
    summary="Get all user reports for admin dashboard",
)
def get_all_reports_for_admin(
    user_id: int = Depends(verify_admin_or_support_role),
):
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    r.report_id,
                    r.user_id,
                    CONCAT(u.first_name, ' ', u.last_name) AS user_name,
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
    summary="Submit admin response to a user ticket",
)
def reply_to_report(
    report_id: int,
    data: AdminReportReplyRequest,
    user_id: int = Depends(verify_admin_or_support_role),
):
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
                    detail="Report not found in database.",
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
    summary="Update status for a reservation or report",
)
def manage_entity(
    data: AdminManageRequest,
    user_id: int = Depends(verify_admin_or_support_role),
):
    if data.entity_type == "report":
        valid_statuses = ["under_review", "resolved", "closed"]
        if data.new_status not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Invalid status '{data.new_status}' for report. "
                    f"Allowed values: {', '.join(valid_statuses)}"
                ),
            )
    else:
        valid_statuses = ["pending", "confirmed", "cancelled"]
        if data.new_status not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Invalid status '{data.new_status}' for reservation. "
                    f"Allowed values: {', '.join(valid_statuses)}"
                ),
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
            return {
                "message": (
                    f"{data.entity_type.capitalize()} status updated to "
                    f"'{data.new_status}' successfully."
                )
            }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )
