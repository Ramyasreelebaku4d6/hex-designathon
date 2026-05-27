from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# --- Auth ---
class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str

# --- User ---
class UserCreate(BaseModel):
    emp_id: str
    name: str
    email: EmailStr
    password: str
    business_unit: Optional[str] = None
    location: Optional[str] = None
    manager_email: Optional[str] = None
    tenure_start_date: Optional[datetime] = None
    role: Optional[str] = "candidate"

class UserResponse(BaseModel):
    id: str
    emp_id: str
    name: str
    email: str
    business_unit: Optional[str]
    location: Optional[str]
    role: str
    class Config:
        from_attributes = True

# --- Drive ---
class DriveCreate(BaseModel):
    name: str
    sponsor: Optional[str] = None
    budget: Optional[float] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    policy_url: Optional[str] = None

class DriveResponse(BaseModel):
    id: str
    name: str
    sponsor: Optional[str]
    budget: Optional[float]
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    status: str
    created_at: datetime
    class Config:
        from_attributes = True

# --- Registration ---
class RegistrationCreate(BaseModel):
    drive_id: str
    exam_track: Optional[str] = None
    slot_datetime: Optional[datetime] = None
    prior_attempts: Optional[int] = 0

class RegistrationResponse(BaseModel):
    id: str
    drive_id: str
    user_id: str
    exam_track: Optional[str]
    status: str
    created_at: datetime
    class Config:
        from_attributes = True

# --- Eligibility ---
class EligibilityResponse(BaseModel):
    id: str
    registration_id: str
    decision: Optional[str]
    ai_score: Optional[float]
    ai_reasons: Optional[str]
    class Config:
        from_attributes = True

class ApprovalRequest(BaseModel):
    decision: str  # "eligible" or "ineligible"
    reason: Optional[str] = None
    cert_id: Optional[str] = None

# --- Results ---
class ResultCreate(BaseModel):
    registration_id: str
    score: float
    outcome: str  # "pass" or "fail"
    evidence_url: Optional[str] = None
    exam_date: Optional[datetime] = None

class ResultResponse(BaseModel):
    id: str
    registration_id: str
    score: float
    outcome: str
    exam_date: Optional[datetime]
    class Config:
        from_attributes = True

# --- Voucher ---
class VoucherCreate(BaseModel):
    drive_id: str
    vendor: str
    code: str
    expiry_date: datetime

class VoucherResponse(BaseModel):
    id: str
    vendor: Optional[str]
    masked_code: Optional[str]
    status: str
    expiry_date: Optional[datetime]
    class Config:
        from_attributes = True

# --- AI ---
class NLQueryRequest(BaseModel):
    question: str

class NLQueryResponse(BaseModel):
    question: str
    sql: str
    answer: str
    data: Optional[List[dict]] = None

class EmailDraftRequest(BaseModel):
    registration_id: str
    context: Optional[str] = None

class EmailDraftResponse(BaseModel):
    subject: str
    body: str

# --- Dashboard ---
class DashboardStats(BaseModel):
    total_drives: int
    total_registrations: int
    eligible_count: int
    passed_count: int
    vouchers_issued: int
    vouchers_redeemed: int

# --- Certifications ---
class CertificationCreate(BaseModel):
    name: str
    code: Optional[str] = None

class CertificationResponse(BaseModel):
    id: str
    name: str
    code: Optional[str]
    is_custom: bool
    class Config:
        from_attributes = True

class DriveCertificationAdd(BaseModel):
    cert_id: Optional[str] = None
    name: Optional[str] = None  # for new cert
    code: Optional[str] = None

# --- Slots ---
class SlotResponse(BaseModel):
    id: str
    slot_datetime: datetime
    is_booked: bool
    booked_by_reg_id: Optional[str]
    class Config:
        from_attributes = True

# --- Updated Registration ---
class RegistrationCreate(BaseModel):
    drive_id: str
    cert_id: Optional[str] = None
    custom_cert_name: Optional[str] = None
    is_custom_cert: Optional[bool] = False
    slot_id: Optional[str] = None
    exam_track: Optional[str] = None
    slot_datetime: Optional[datetime] = None