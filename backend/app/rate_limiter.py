from slowapi import Limiter
from slowapi.util import get_remote_address

# Initialize Limiter using the client's IP address
limiter = Limiter(key_func=get_remote_address)
