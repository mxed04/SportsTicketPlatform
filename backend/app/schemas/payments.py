from pydantic import BaseModel, Field
from datetime import datetime


class PaymentRequest(BaseModel):
    reservation_id: int = Field(..., gt=0, examples=[101])
    payment_method: str = Field(
        ...,
        min_length=1,
        examples=["credit_card"],
        description="Payment method used (e.g., credit_card)",
    )


class PaymentResponse(BaseModel):
    payment_id: int
    reservation_id: int
    amount: float
    status: str
    message: str
    paid_at: datetime
    # 🔴 Added: Field to hold the Base64 QR code image
    qr_code: str | None = Field(
        None,
        description="Base64 encoded QR Code string for the digital ticket",
    )
