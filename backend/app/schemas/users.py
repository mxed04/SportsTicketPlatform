from pydantic import BaseModel, Field
from datetime import datetime


class BookingResponse(BaseModel):
    reservation_id: int
    ticket_id: int
    home_team: str
    away_team: str
    match_date: datetime
    reservation_status: str
    payment_status: str | None
    amount_paid: float | None
    reserved_at: datetime


class UserProfileUpdate(BaseModel):
    first_name: str | None = Field(
        default=None,
        min_length=2,
        examples=["Ali"],
    )
    last_name: str | None = Field(
        default=None,
        min_length=2,
        examples=["Rezaei"],
    )
    city: str | None = Field(
        default=None,
        min_length=2,
        examples=["Shiraz"],
    )
