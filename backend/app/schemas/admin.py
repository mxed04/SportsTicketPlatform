from pydantic import BaseModel, Field
from typing import Literal
from datetime import datetime


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
