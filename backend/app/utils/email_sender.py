import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings
import logging

logger = logging.getLogger(__name__)


def send_real_otp_email(receiver_email: str, otp_code: str) -> bool:
    """
    Sending an actual OTP code to the user's email via the SMTP service.
    """
    # If email settings are not entered in the .env file,
    # a log entry will appear in the console.
    if not getattr(settings, "SMTP_USER", None) or not getattr(
        settings, "SMTP_PASSWORD", None
    ):
        warning_message = (
            "⚠️ [SMTP NOT CONFIGURED] OTP code for "
            f"{receiver_email}: {otp_code}"
        )
        logger.warning(warning_message)
        return False

    try:
        smtp_server = getattr(settings, "SMTP_SERVER", "smtp.gmail.com")
        smtp_port = int(getattr(settings, "SMTP_PORT", 587))
        sender_email = settings.SMTP_USER
        password = settings.SMTP_PASSWORD

        # Constructing the email body
        message = MIMEMultipart("alternative")
        message["Subject"] = (
            "Access code for the sports event ticket booking platform"
        )
        message["From"] = sender_email
        message["To"] = receiver_email

        text_content = (
            f"Your verification code: {otp_code}\n"
            "This code is valid for 5 minutes."
        )
        html_content = f"""
        <div
            style="
                direction: rtl;
                text-align: right;
                font-family: Tahoma, sans-serif;
                padding: 20px;
                border: 1px solid #ddd;
                border-radius: 8px;
            "
        >
            <h2>Sports Event Ticket Booking Platform</h2>
            <p>Hello, your one-time verification code for login:</p>
            <h1 style="color: #2b6cb0; letter-spacing: 4px;">{otp_code}</h1>
            <p
                style="
                    font-size: 12px;
                    color: #718096;
                "
            >This code is valid for 5 minutes.</p>
        </div>
        """

        message.attach(MIMEText(text_content, "plain"))
        message.attach(MIMEText(html_content, "html"))

        # Sending the email via SMTP
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(sender_email, password)
            server.sendmail(sender_email, receiver_email, message.as_string())

        logger.info(f"✅ Email sent successfully to {receiver_email}.")
        return True

    except Exception as e:
        logger.error(f"❌ Error sending email: {str(e)}")
        return False
