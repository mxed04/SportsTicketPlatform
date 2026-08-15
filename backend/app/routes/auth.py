import logging

# 🔴 Added Request
from fastapi import (
    APIRouter,
    HTTPException,
    status,
    Depends,
    Request,
)
from fastapi.security import (
    OAuth2PasswordRequestForm,
    OAuth2PasswordBearer,
)
from app.schemas.auth import (
    OTPRequest,
    OTPResponse,
    UserSignup,
    TokenResponse,
    PasswordResetRequest,
)
from app.redis_client import generate_and_set_otp, verify_otp
from app.database import get_db_cursor
from app.security import (
    create_access_token,
    get_password_hash,
    verify_password,
)
from app.routes.reservations import get_current_user_id

# 🔴 Imported limiter
from app.rate_limiter import limiter

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


@router.post(
    "/otp",
    response_model=OTPResponse,
    status_code=status.HTTP_200_OK,
)
# 🔴 Security guard: Maximum 3 times per minute.
@limiter.limit("3/minute")
def request_otp(request: Request, data: OTPRequest):
    # 🔴 Adding a request
    otp_code = generate_and_set_otp(data.phone_number)

    logger.info(
        (
            f"📩 MOCK SMS/EMAIL DELIVERY: "
            f"OTP code for {data.phone_number} is {otp_code}"
        )
    )

    return {
        "message": "OTP sent successfully",
        "expires_in": "120 seconds",
    }


@router.post(
    "/signup",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def signup(data: UserSignup):
    # 1. Verify OTP
    if not verify_otp(data.phone_number, data.otp_code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP code",
        )

    try:
        with get_db_cursor() as cursor:
            # 2. Check if user already exists
            cursor.execute(
                (
                    "SELECT user_id FROM users "
                    "WHERE phone_number = %s OR email = %s;"
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
            hashed_password = get_password_hash(data.password)
            insert_query = """
                INSERT INTO users (
                    phone_number, email, password_hash,
                    first_name, last_name, city
                )
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING user_id, role;
            """
            cursor.execute(
                insert_query,
                (
                    data.phone_number,
                    data.email,
                    hashed_password,
                    data.first_name,
                    data.last_name,
                    data.city,
                ),
            )
            new_user = cursor.fetchone()
            cursor.connection.commit()

            access_token = create_access_token(
                data={
                    "sub": str(new_user["user_id"]),
                    "role": new_user["role"],
                },
            )
            return {
                "access_token": access_token,
                "token_type": "bearer",
                "message": "User registered successfully",
            }

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}",
        )


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    try:
        with get_db_cursor() as cursor:
            cursor.execute(
                (
                    "SELECT user_id, password_hash, role, "
                    "is_active FROM users "
                    "WHERE phone_number = %s;"
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

            if not user["is_active"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=(
                        "User account is deactivated. "
                        "Please contact support."
                    ),
                )

            access_token = create_access_token(
                data={
                    "sub": str(user["user_id"]),
                    "role": user["role"],
                }
            )
            return {
                "access_token": access_token,
                "token_type": "bearer",
                "message": "Login successful",
            }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        err_msg = f"Database error: {str(e)}"
        raise HTTPException(
            status_code=500, detail=err_msg
        )


@router.post(
    "/reset-password",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="Reset forgotten password using OTP",
)
def reset_password(data: PasswordResetRequest):
    # 1. Verification of the confirmation code from Redis
    if not verify_otp(data.phone_number, data.otp_code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP code",
        )

    try:
        with get_db_cursor() as cursor:
            # 2. Checking whether a user with this number exists.
            cursor.execute(
                (
                    "SELECT user_id FROM users "
                    "WHERE phone_number = %s;"
                ),
                (data.phone_number,),
            )
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=(
                        "User with this phone number "
                        "does not exist"
                    ),
                )

            # 3. Hashing the new password and update database
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
        "message": (
            f"If you see this, you are authenticated. "
            f"Your user_id is {user_id}."
        ),
    }
