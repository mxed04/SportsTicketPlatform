from pydantic import BaseModel, Field, ConfigDict
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
    is_surge_pricing: bool = Field(
        default=False,
        description=(
            "Indicates if dynamic surge pricing is currently active "
            "due to high demand"
        ),
    )

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "ticket_id": 1,
                    "title": "Esteghlal vs Persepolis",
                    "sport_type": "football",
                    "home_team": "Esteghlal",
                    "away_team": "Persepolis",
                    "venue_name": "Azadi Stadium",
                    "city": "Tehran",
                    "ticket_tier": "VIP",
                    "organizer": "سازمان لیگ",
                    "match_date": "2026-08-03T07:46:08.748Z",
                    "price": 50000.0,
                    "remaining_capacity": 4500,
                    "is_active": True,
                    "is_surge_pricing": False,
                },
                {
                    "ticket_id": 2,
                    "title": "Tractor vs Sepahan",
                    "sport_type": "football",
                    "home_team": "Tractor",
                    "away_team": "Sepahan",
                    "venue_name": "Yadegar-e Emam",
                    "city": "Tabriz",
                    "ticket_tier": "Regular",
                    "organizer": "سازمان لیگ",
                    "match_date": "2026-09-10T18:00:00.000Z",
                    "price": 57500.0,
                    "remaining_capacity": 15,
                    "is_active": True,
                    "is_surge_pricing": True,
                },
            ]
        }
    )


class TicketListResponse(BaseModel):
    source: str
    count: int
    tickets: list[TicketResponse]
    suggestions: list[TicketResponse] | None = None

    # This is a consolidated response model for ticket listings,
    # including both the main tickets and any suggested tickets.
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "source": "database (PostgreSQL) 🐘",
                    "count": 2,
                    "tickets": [
                        {
                            "ticket_id": 1,
                            "title": "Esteghlal vs Persepolis",
                            "sport_type": "football",
                            "home_team": "Esteghlal",
                            "away_team": "Persepolis",
                            "venue_name": "Azadi Stadium",
                            "city": "Tehran",
                            "ticket_tier": "VIP",
                            "organizer": "سازمان لیگ",
                            "match_date": "2026-08-03T07:46:08.748Z",
                            "price": 50000.0,
                            "remaining_capacity": 4500,
                            "is_active": True,
                            "is_surge_pricing": False,  # general mode
                        },
                        {
                            "ticket_id": 2,
                            "title": "Tractor vs Sepahan",
                            "sport_type": "football",
                            "home_team": "Tractor",
                            "away_team": "Sepahan",
                            "venue_name": "Yadegar-e Emam",
                            "city": "Tabriz",
                            "ticket_tier": "Regular",
                            "organizer": "سازمان لیگ",
                            "match_date": "2026-09-10T18:00:00.000Z",
                            "price": 57500.0,
                            "remaining_capacity": 15,
                            "is_active": True,
                            "is_surge_pricing": True,  # dynamic pricing mode
                        },
                    ],
                    "suggestions": [],
                }
            ]
        }
    )


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
