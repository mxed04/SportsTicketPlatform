from pydantic import BaseModel, EmailStr, Field, ConfigDict


# --- Input Models (Request) ---
class OTPRequest(BaseModel):
    phone_number: str = Field(
        ...,
        pattern=r"^09[0-9]{9}$",
        examples=["09123456789"],
        description=(
            "Must be a valid 11-digit Iranian phone number " "starting with 09"
        ),
    )
    model_config = ConfigDict(
        json_schema_extra={"example": {"phone_number": "09123456789"}}
    )


class UserSignup(BaseModel):
    phone_number: str = Field(
        ...,
        pattern=r"^09[0-9]{9}$",
        examples=["09123456789"],
    )
    email: EmailStr = Field(
        ...,
        examples=["test@example.com"],
    )
    password: str = Field(
        ...,
        min_length=8,
        examples=["StrongPassword123!"],
    )
    otp_code: str = Field(
        ...,
        min_length=6,
        max_length=6,
        examples=["123456"],
    )
    first_name: str = Field(
        ...,
        min_length=2,
        examples=["Ali"],
    )
    last_name: str = Field(
        ...,
        min_length=2,
        examples=["Rezaei"],
    )
    city: str = Field(
        ...,
        min_length=2,
        examples=["Tehran"],
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "phone_number": "09123456789",
                "email": "test@example.com",
                "password": "StrongPassword123!",
                "otp_code": "123456",
                "first_name": "Ali",
                "last_name": "Rezaei",
                "city": "Tehran",
            }
        }
    )


class UserLogin(BaseModel):
    phone_number: str = Field(..., pattern=r"^09[0-9]{9}$")
    password: str


# --- Output Models (Response) ---
class OTPResponse(BaseModel):
    message: str
    expires_in: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    message: str | None = None
