import httpx
import json
import secrets
import string
import hashlib
from datetime import datetime
from app.core.config import settings

async def generate_unique_voucher_codes(
    count: int,
    cert_name: str,
    drive_name: str,
    existing_codes: list[str] = []
) -> list[str]:
    """
    Use GPT to generate unique, formatted voucher codes.
    Falls back to cryptographically secure random generation.
    """
    try:
        # Ask AI to generate structured unique codes
        prompt = f"""
Generate exactly {count} unique voucher codes for a certification exam.

Context:
- Certification: {cert_name}
- Drive: {drive_name}
- Generated at: {datetime.utcnow().isoformat()}

Requirements:
- Format: XXXX-XXXX-XXXX-XXXX (4 groups of 4 alphanumeric chars)
- Uppercase letters and numbers only
- No ambiguous chars (0, O, I, 1)
- Every code must be completely unique
- No pattern that can be guessed

Return ONLY a JSON array of {count} strings. No explanation.
Example: ["AB23-CD45-EF67-GH89", "JK23-LM45-NP67-QR89"]
"""
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{settings.MODEL_ENDPOINT}/chat/completions",
                headers={
                    "api-key": settings.MODEL_SUBSCRIPTION_KEY,
                    "Content-Type": "application/json"
                },
                json={
                    "model": settings.MODEL_DEPLOYMENT,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a secure voucher code generator. Return only valid JSON arrays."
                        },
                        {"role": "user", "content": prompt}
                    ],
                    "max_completion_tokens": 2000,
                    "temperature": 1.0
                }
            )
            data = response.json()
            raw = data["choices"][0]["message"]["content"].strip()
            # Clean markdown if present
            raw = raw.replace("```json", "").replace("```", "").strip()
            codes = json.loads(raw)

            # Validate and deduplicate
            valid_codes = []
            seen = set(existing_codes)
            for code in codes:
                code = code.strip().upper()
                if code not in seen and len(code) == 19:
                    valid_codes.append(code)
                    seen.add(code)

            # If AI didn't give enough, fill with secure random
            while len(valid_codes) < count:
                fallback = _generate_secure_code(seen)
                valid_codes.append(fallback)
                seen.add(fallback)

            return valid_codes[:count]

    except Exception as e:
        print(f"[VOUCHER-GEN] AI generation failed: {e}, using fallback")
        return _generate_fallback_codes(count, existing_codes)


def _generate_secure_code(existing: set) -> str:
    """Cryptographically secure voucher code."""
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no ambiguous chars
    while True:
        parts = []
        for _ in range(4):
            part = "".join(secrets.choice(chars) for _ in range(4))
            parts.append(part)
        code = "-".join(parts)
        if code not in existing:
            return code


def _generate_fallback_codes(count: int, existing_codes: list) -> list[str]:
    """Pure Python fallback — no AI needed."""
    seen = set(existing_codes)
    codes = []
    while len(codes) < count:
        code = _generate_secure_code(seen)
        codes.append(code)
        seen.add(code)
    return codes


def calculate_voucher_distribution(
    budget: float,
    cert_names: list[str],
    voucher_cost: int = 1000
) -> dict:
    """
    Calculate how many vouchers per certification.
    Distributes budget equally across certs.
    """
    if not cert_names or budget <= 0:
        return {}

    per_cert_budget = budget / len(cert_names)
    vouchers_per_cert = max(1, int(per_cert_budget / voucher_cost))

    return {
        cert: vouchers_per_cert
        for cert in cert_names
    }