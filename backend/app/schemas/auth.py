from pydantic import BaseModel, EmailStr, Field, ConfigDict


# --- Input Models (Request) ---
class OTPRequest(BaseModel):
    phone_number: str = Field(
        ...,
        pattern=r"^09[0-9]{9}$",
        description=(
            "Must be a valid 11-digit Iranian phone number " "starting with 09"
        ),
    )

    # 🔴 Corrected: Use of 'examples' (plural) and lists.
    model_config = ConfigDict(
        json_schema_extra={"examples": [{"phone_number": "09123456789"}]}
    )


class UserSignup(BaseModel):
    phone_number: str = Field(..., pattern=r"^09[0-9]{9}$")
    email: EmailStr = Field(...)
    password: str = Field(..., min_length=8)
    otp_code: str = Field(..., min_length=6, max_length=6)
    first_name: str = Field(..., min_length=2)
    last_name: str = Field(..., min_length=2)
    city: str = Field(..., min_length=2)

    # 🔴 Corrected: Use of 'examples' (plural) and lists.
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "phone_number": "09123456789",
                    "email": "test@example.com",
                    "password": "StrongPassword123!",
                    "otp_code": "123456",
                    "first_name": "Ali",
                    "last_name": "Rezaei",
                    "city": "Tehran",
                }
            ]
        }
    )


# --- Output Models (Response) ---
class OTPResponse(BaseModel):
    message: str
    expires_in: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    message: str | None = None
