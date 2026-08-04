import logging
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import (
    OAuth2PasswordRequestForm,
    OAuth2PasswordBearer,
)
from app.schemas.auth import (
    OTPRequest,
    OTPResponse,
    UserSignup,
    TokenResponse,
)
from app.redis_client import generate_and_set_otp, verify_otp
from app.database import get_db_cursor
from app.security import (
    create_access_token,
    get_password_hash,
    verify_password,
)
from app.routes.reservations import get_current_user_id

# if we want to send real OTP emails, we can import the email sender function
# from app.email_sender import send_real_otp_email

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


@router.post(
    "/otp",
    response_model=OTPResponse,
    status_code=status.HTTP_200_OK,
)
def request_otp(data: OTPRequest):
    otp_code = generate_and_set_otp(data.phone_number)

    logger.info(
        "📩 MOCK SMS/EMAIL DELIVERY: "
        f"OTP code for {data.phone_number} is {otp_code}"
    )

    # if we want to send real OTP emails in the future:
    # send_real_otp_email(receiver_email=..., otp_code=otp_code)

    return {
        "message": "OTP sent successfully",
        "expires_in": "120 seconds",
        # "otp": otp_code  # omit OTP from response in production for security
    }


@router.post(
    "/signup",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def signup(data: UserSignup):
    if not verify_otp(data.phone_number, data.otp_code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP code",
        )

    try:
        with get_db_cursor() as cursor:
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
                        "User with this phone number or email already exists"
                    ),
                )

            password_hash = get_password_hash(data.password)
            cursor.execute(
                (
                    "INSERT INTO users (phone_number, email, password_hash, "
                    "first_name, last_name, city, role) "
                    "VALUES (%s, %s, %s, %s, %s, %s, 'audience') "
                    "RETURNING user_id, role;"
                ),
                (
                    data.phone_number,
                    data.email,
                    password_hash,
                    data.first_name,
                    data.last_name,
                    data.city,
                ),
            )
            new_user = cursor.fetchone()
            cursor.connection.commit()

            token_data = {
                "sub": str(new_user["user_id"]),
                "role": new_user["role"],
            }
            access_token = create_access_token(data=token_data)

            return {
                "access_token": access_token,
                "token_type": "bearer",
                "message": "User registered successfully",
            }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        # Keep line length within limits
        err_msg = "Database error: " + str(e)
        raise HTTPException(status_code=500, detail=err_msg)


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    with get_db_cursor() as cursor:
        cursor.execute(
            (
                "SELECT user_id, password_hash, role FROM users "
                "WHERE phone_number = %s;"
            ),
            (form_data.username,),
        )
        user = cursor.fetchone()
        if not user or not verify_password(
            form_data.password,
            user["password_hash"],
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid phone number or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        token_data = {
            "sub": str(user["user_id"]),
            "role": user["role"],
        }
        return {
            "access_token": create_access_token(data=token_data),
            "token_type": "bearer",
            "message": "Login successful",
        }


@router.get(
    "/me/test-auth",
    response_model=dict,
    tags=["Authentication"],
)
def test_auth(user_id: int = Depends(get_current_user_id)):
    return {
        "message": "You are authenticated successfully!",
        "user_id": user_id,
    }
