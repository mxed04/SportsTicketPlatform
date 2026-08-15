from fastapi import APIRouter, Depends, HTTPException, status
from app.database import get_db_cursor
from app.routes.reservations import get_current_user_id
from app.schemas.admin import (
    AdminManageRequest,
    AdminReservationResponse,
    DashboardStatsResponse,
)

router = APIRouter(prefix="/api/admin", tags=["Admin Dashboard"])


def verify_admin_or_support_role(
    user_id: int = Depends(get_current_user_id),
) -> int:
    """
    Access level validation: Only users with the 'admin' or 'support' role are
    permitted to access.
    Otherwise, a 403 Forbidden error is returned.
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
def get_dashboard_statistics(
    user_id: int = Depends(verify_admin_or_support_role),
):
    try:
        with get_db_cursor() as cursor:
            sql = (
                "SELECT "
                "(SELECT COALESCE(SUM(amount), 0) "
                "FROM payments "
                "WHERE status = 'successful' AND amount > 0) "
                "AS total_revenue, "
                "(SELECT COUNT(*) FROM payments "
                "WHERE status = 'successful' AND amount > 0) "
                "AS total_tickets_sold, "
                "(SELECT COUNT(*) FROM reservations "
                "WHERE status = 'cancelled') "
                "AS total_cancellations, "
                "(SELECT COUNT(*) FROM reports "
                "WHERE status = 'under_review') "
                "AS pending_reports;"
            )
            cursor.execute(sql)
            return cursor.fetchone()
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.get(
    "/tickets",
    response_model=list[AdminReservationResponse],
    status_code=status.HTTP_200_OK,
    summary="Get all reservations and payment statuses for admin/support",
)
def get_admin_tickets(
    user_id: int = Depends(verify_admin_or_support_role),
):
    try:
        with get_db_cursor() as cursor:
            # Fixed: SELECT columns aligned with AdminReservationResponse.
            sql = (
                "SELECT r.reservation_id, r.user_id, "
                "u.first_name, u.last_name, u.phone_number, "
                "r.ticket_id, t.venue_name, "
                "t.match_date, r.status, p.amount AS payment_amount "
                "FROM reservations r "
                "JOIN users u ON r.user_id = u.user_id "
                "JOIN tickets t ON r.ticket_id = t.ticket_id "
                "LEFT JOIN payments p "
                "ON r.reservation_id = p.reservation_id "
                "ORDER BY r.reserved_at DESC;"
            )
            cursor.execute(sql)
            return cursor.fetchall()
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}",
        )


@router.put(
    "/manage",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="Manage entities (update report or reservation status)",
)
def manage_entity(
    data: AdminManageRequest,
    user_id: int = Depends(verify_admin_or_support_role),
):
    # 🔴 New update: Validation of allowed values for the
    # 'status' field in the reservations table.
    if data.entity_type == "reservation":
        valid_statuses = {"pending", "paid", "cancelled"}
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
