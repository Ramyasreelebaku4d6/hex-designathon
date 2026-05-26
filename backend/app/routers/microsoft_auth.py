from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import httpx
from pydantic import BaseModel
from app.database import get_db
from app.models import User
from app.auth import create_access_token
import uuid

router = APIRouter()

class TokenRequest(BaseModel):
    access_token: str

@router.post("/verify-token")
async def verify_microsoft_token(
    request: TokenRequest,
    db: Session = Depends(get_db)
):
    """
    Receives Microsoft access token from frontend MSAL.
    Verifies by calling Graph API.
    Creates or logs in user.
    Issues JWT.
    """
    async with httpx.AsyncClient() as client:
        graph_response = await client.get(
            "https://graph.microsoft.com/v1.0/me",
            headers={"Authorization": f"Bearer {request.access_token}"}
        )

    if graph_response.status_code != 200:
        raise HTTPException(
            status_code=401,
            detail="Invalid Microsoft token"
        )

    ms_user = graph_response.json()
    print(f"[MS-AUTH] Graph user: {ms_user}")

    ms_id = ms_user.get("id")
    ms_email = (
        ms_user.get("mail") or
        ms_user.get("userPrincipalName") or ""
    )
    ms_name = ms_user.get("displayName") or ms_email.split("@")[0]
    ms_emp_id = ms_user.get("employeeId") or (ms_id[:8] if ms_id else str(uuid.uuid4())[:8])

    if not ms_email:
        raise HTTPException(
            status_code=400,
            detail="Could not get email from Microsoft account"
        )

    # Find by microsoft_id first
    user = db.query(User).filter(
        User.microsoft_id == ms_id
    ).first()

    # Fallback to email match
    if not user:
        user = db.query(User).filter(
            User.email.ilike(ms_email)
        ).first()

    if user:
        if not user.microsoft_id:
            user.microsoft_id = ms_id
            db.commit()
        print(f"[MS-AUTH] Login: {user.email} role={user.role}")
    else:
        # Auto-create as candidate
        user = User(
            id=str(uuid.uuid4()),
            emp_id=ms_emp_id,
            name=ms_name,
            email=ms_email,
            password_hash="MICROSOFT_SSO",
            microsoft_id=ms_id,
            role="candidate"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"[MS-AUTH] Created new user: {ms_email}")

    token = create_access_token({
        "sub": user.id,
        "role": user.role
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "name": user.name,
        "email": user.email,
        "login_method": "microsoft"
    }