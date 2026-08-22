from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field


class DashboardStatsResponse(BaseModel):
    total_revenue: float
    total_tickets_sold: int
    total_cancellations: int
    pending_reports: int


class AdminManageRequest(BaseModel):
    entity_type: Literal["reservation", "report"] = Field(
        ..., examples=["report"]
    )
    entity_id: int = Field(..., gt=0, examples=[1])
    new_status: str = Field(..., min_length=1, examples=["resolved"])


class AdminReservationResponse(BaseModel):
    reservation_id: int
    user_id: int
    first_name: str
    last_name: str
    phone_number: str
    ticket_id: int
    venue_name: str
    match_date: datetime
    status: str
    payment_amount: float | None = None


class AdminReportReplyRequest(BaseModel):
    admin_response: str = Field(
        ...,
        min_length=1,
        examples=["The support response has been recorded."]
    )
    status: str = Field("resolved", examples=["resolved"])


class AdminReportResponse(BaseModel):
    report_id: int
    user_id: int
    user_name: Optional[str] = None
    ticket_id: Optional[int] = None
    reservation_id: Optional[int] = None
    category: str
    report_text: str
    admin_response: Optional[str] = None
    status: str
    created_at: datetime


class TicketCreateRequest(BaseModel):
    home_team: str = Field(..., min_length=1, examples=["Real Madrid"])
    away_team: str = Field(..., min_length=1, examples=["Barcelona"])
    sport_type: Literal["football", "volleyball", "basketball"] = Field(
        ..., examples=["football"]
    )
    ticket_tier: str = Field(..., examples=["VIP"])
    organizer: str = Field(..., examples=["FIFA"])
    venue_name: str = Field(..., examples=["Santiago Bernabeu"])
    city: str = Field(..., examples=["Madrid"])
    match_date: datetime
    price: float = Field(..., ge=0.0, examples=[1500000.0])
    remaining_capacity: int = Field(..., ge=0, examples=[150])


# 🚀 NEW: Schema for Audit Logs
class AuditLogResponse(BaseModel):
    log_id: int
    reservation_id: int
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    changed_at: datetime