import logging
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    status,
)
from fastapi.security import (
    OAuth2PasswordBearer,
    OAuth2PasswordRequestForm,
)

from app.database import get_db_cursor
from app.rate_limiter import limiter
from app.redis_client import generate_and_set_otp, verify_otp
from app.routes.reservations import get_current_user_id
from app.schemas.auth import (
    OTPRequest,
    OTPResponse,
    PasswordResetRequest,
    TokenResponse,
    UserSignup,
)
from app.security import (
    create_access_token,
    get_password_hash,
    verify_password,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


@router.post(
    "/otp",
    response_model=OTPResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("3/minute")
def request_otp(request: Request, data: OTPRequest):
    """Generates an OTP code and saves it in Redis with a
      2-minute expiration."""
    otp_code = generate_and_set_otp(data.phone_number)
    logger.info(
        f"Generated OTP '{otp_code}' for phone number: {data.phone_number}"
    )

    return OTPResponse(
        message="OTP sent successfully. Valid for 2 minutes.",
        otp_code=otp_code,
    )


@router.post(
    "/signup",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
)
def signup(data: UserSignup):
    """Verifies OTP and registers a new user in PostgreSQL."""
    # 1. Verify OTP from Redis
    if not verify_otp(data.phone_number, data.otp_code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP code.",
        )

    try:
        with get_db_cursor() as cursor:
            # 2. Check if phone_number or email already exists
            cursor.execute(
                (
                    "SELECT id FROM users WHERE phone_number = %s "
                    "OR email = %s;"
                ),
                (data.phone_number, data.email),
            )
            if cursor.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "User with this phone number or "
                        "email already exists"
                    ),
                )

            # 3. Hash password and insert user
            hashed_pwd = get_password_hash(data.password)
            cursor.execute(
                (
                    "INSERT INTO users (first_name, last_name, "
                    "phone_number, email, password_hash, role, city) "
                    "VALUES (%s, %s, %s, %s, %s, 'audience', %s) "
                    "RETURNING id;"
                ),
                (
                    data.first_name,
                    data.last_name,
                    data.phone_number,
                    data.email,
                    hashed_pwd,
                    data.city,
                ),
            )
            new_user = cursor.fetchone()
            cursor.connection.commit()

            return {
                "message": "User registered successfully",
                "user_id": new_user["id"],
            }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        err_msg = f"Database error: {str(e)}"
        raise HTTPException(
            status_code=500, detail=err_msg
        )


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Authenticates user via OAuth2 Form (phone_number = username)
      and returns JWT."""
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                (
                    "SELECT id, password_hash, role "
                    "FROM users WHERE phone_number = %s;"
                ),
                (form_data.username,),
            )
            user = cursor.fetchone()

            if not user or not verify_password(
                form_data.password, user["password_hash"]
            ):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect phone number or password",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            # Generate Access Token
            access_token = create_access_token(
                data={"sub": str(user["id"]), "role": user["role"]}
            )

            return TokenResponse(
                access_token=access_token, token_type="bearer"
            )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        err_msg = f"Database error: {str(e)}"
        raise HTTPException(
            status_code=500, detail=err_msg
        )


@router.post("/reset-password", response_model=dict)
def reset_password(data: PasswordResetRequest):
    """Resets user password after verifying OTP."""
    # 1. Verify OTP
    if not verify_otp(data.phone_number, data.otp_code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP code.",
        )

    try:
        with get_db_cursor() as cursor:
            # 2. Check if user exists
            cursor.execute(
                "SELECT id FROM users WHERE phone_number = %s;",
                (data.phone_number,),
            )
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User with this phone number does not exist",
                )

            # 3. Hash new password & update
            new_password_hash = get_password_hash(data.new_password)
            cursor.execute(
                (
                    "UPDATE users SET password_hash = %s "
                    "WHERE phone_number = %s;"
                ),
                (new_password_hash, data.phone_number),
            )
            cursor.connection.commit()

            return {
                "message": (
                    "Password has been reset successfully. "
                    "You can now login."
                )
            }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        err_msg = f"Database error: {str(e)}"
        raise HTTPException(
            status_code=500, detail=err_msg
        )


@router.get(
    "/me/test-auth",
    response_model=dict,
    tags=["Authentication"],
)
def test_auth(user_id: int = Depends(get_current_user_id)):
    return {
        "message": f"If you see this, you are authenticated. User ID:"
        f"{user_id}"
    }