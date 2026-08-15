from pydantic import BaseModel, Field
from datetime import datetime


class ReportCreate(BaseModel):
    category: str = Field(..., examples=["Payment Issue"])
    report_text: str = Field(
        ...,
        examples=["Money deducted but reservation failed."],
    )
    ticket_id: int | None = Field(default=None, examples=[10])
    reservation_id: int | None = Field(default=None, examples=[101])


class ReportResponse(BaseModel):
    report_id: int
    user_id: int
    ticket_id: int | None = None
    reservation_id: int | None = None
    category: str
    report_text: str
    status: str
    created_at: datetime
