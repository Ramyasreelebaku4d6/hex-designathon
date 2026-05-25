from cryptography.fernet import Fernet
from app.core.config import settings
import base64
import hashlib

# Generate consistent key from SECRET_KEY
def get_fernet():
    key = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    encoded_key = base64.urlsafe_b64encode(key)
    return Fernet(encoded_key)

def encrypt_voucher_code(code: str) -> str:
    f = get_fernet()
    return f.encrypt(code.encode()).decode()

def decrypt_voucher_code(encrypted_code: str) -> str:
    f = get_fernet()
    return f.decrypt(encrypted_code.encode()).decode()

def mask_voucher_code(code: str) -> str:
    # Show only last 4 characters
    return "*" * (len(code) - 4) + code[-4:]