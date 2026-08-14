from pydantic import BaseModel, Field
from datetime import datetime


class TicketResponse(BaseModel):
    ticket_id: int
    title: str  # Generated dynamically in Python
    sport_type: str
    home_team: str
    away_team: str
    venue_name: str
    city: str
    ticket_tier: str
    organizer: str
    match_date: datetime
    price: float
    remaining_capacity: int
    is_active: bool
    # 🔴 Added: Indicates if Dynamic/Surge Pricing is active for this ticket
    is_surge_pricing: bool = False


class TicketListResponse(BaseModel):
    source: str
    count: int
    tickets: list[TicketResponse]
    # A list to hold fuzzy search suggestions when exact matches fail
    suggestions: list[TicketResponse] | None = None


class TicketDetailResponse(TicketResponse):
    # Consolidated 3NF Specific Details
    league_name: str | None = None
    facility_name: str | None = None
    seat_section: str | None = None
    row_number: int | None = None
    seat_number: int | None = None
    specific_ticket_tier: str | None = None
    amenities: str | None = None


class CancellationPenaltyResponse(BaseModel):
    reservation_id: int
    match_date: datetime
    hours_until_match: float
    penalty_percentage: int
    penalty_amount: float
    refund_amount: float


class CancelTicketRequest(BaseModel):
    reservation_id: int = Field(..., gt=0, examples=[101])
