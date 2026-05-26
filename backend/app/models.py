from sqlalchemy import (
    Column, String, Integer, Float,
    Boolean, DateTime, Text, ForeignKey
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import uuid

def gen_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    emp_id = Column(String(50), unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    email = Column(String(200), unique=True, nullable=False)
    password_hash = Column(String(200), nullable=False)
    business_unit = Column(String(100))
    location = Column(String(100))
    manager_email = Column(String(200))
    tenure_start_date = Column(DateTime)
    role = Column(String(20), default="candidate")
    created_at = Column(DateTime, server_default=func.now())

    registrations = relationship("Registration", back_populates="user")

class Drive(Base):
    __tablename__ = "drives"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    name = Column(String(200), nullable=False)
    sponsor = Column(String(200))
    budget = Column(Float)
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    policy_url = Column(String(500))
    status = Column(String(20), default="draft")
    pass_threshold = Column(Float, default=70.0)
    created_at = Column(DateTime, server_default=func.now())

    registrations = relationship("Registration", back_populates="drive")
    vouchers = relationship("Voucher", back_populates="drive")
    certifications = relationship("DriveCertification", back_populates="drive")  # NEW
    slots = relationship("ExamSlot", back_populates="drive")  # NEW

class Registration(Base):
    __tablename__ = "registrations"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    drive_id = Column(String(36), ForeignKey("drives.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    exam_track = Column(String(100))
    slot_datetime = Column(DateTime)
    status = Column(String(30), default="submitted")
    prior_attempts = Column(Integer, default=0)
    ack_email_sent_at = Column(DateTime)
    cert_id = Column(String(36), nullable=True)           # NEW
    custom_cert_name = Column(String(200), nullable=True) # NEW
    is_custom_cert = Column(Boolean, default=False)       # NEW
    slot_id = Column(String(36), nullable=True)           # NEW
    created_at = Column(DateTime, server_default=func.now())
    course_completed = Column(Boolean, default=False)  # add inside Registration class
    
    drive = relationship("Drive", back_populates="registrations")
    user = relationship("User", back_populates="registrations")
    eligibility = relationship(
        "Eligibility", back_populates="registration", uselist=False
    )
    result = relationship(
        "AssessmentResult", back_populates="registration", uselist=False
    )
    voucher = relationship(
        "Voucher", back_populates="registration", uselist=False
    )

class Eligibility(Base):
    __tablename__ = "eligibility"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    registration_id = Column(
        String(36), ForeignKey("registrations.id"), unique=True
    )
    criteria_json = Column(Text)
    decision = Column(String(20))
    ai_score = Column(Float)
    ai_reasons = Column(Text)
    approver_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    decision_date = Column(DateTime)

    registration = relationship("Registration", back_populates="eligibility")

class AssessmentResult(Base):
    __tablename__ = "assessment_results"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    registration_id = Column(
        String(36), ForeignKey("registrations.id"), unique=True
    )
    score = Column(Float)
    outcome = Column(String(10))
    evidence_url = Column(String(500))
    exam_date = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())

    registration = relationship("Registration", back_populates="result")

class Voucher(Base):
    __tablename__ = "vouchers"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    drive_id = Column(String(36), ForeignKey("drives.id"))
    registration_id = Column(
        String(36), ForeignKey("registrations.id"), unique=True, nullable=True
    )
    vendor = Column(String(100))
    code_encrypted = Column(Text)
    masked_code = Column(String(50))
    expiry_date = Column(DateTime)
    status = Column(String(20), default="unassigned")
    tokenized_link = Column(String(500))
    delivered_at = Column(DateTime)
    redeemed_at = Column(DateTime)

    drive = relationship("Drive", back_populates="vouchers")
    registration = relationship("Registration", back_populates="voucher")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_type = Column(String(50))
    entity_id = Column(String(36))
    action = Column(String(50))
    actor_id = Column(String(36))
    timestamp = Column(DateTime, server_default=func.now())
    before_json = Column(Text)
    after_json = Column(Text)
    ip_address = Column(String(45))

class Certification(Base):
    __tablename__ = "certifications"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    name = Column(String(200), nullable=False)
    code = Column(String(50), nullable=True)
    is_custom = Column(Boolean, default=False)
    created_by = Column(String(36), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    drive_certifications = relationship(
        "DriveCertification", back_populates="certification"
    )

class DriveCertification(Base):
    __tablename__ = "drive_certifications"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    drive_id = Column(String(36), ForeignKey("drives.id"), nullable=False)
    cert_id = Column(String(36), ForeignKey("certifications.id"), nullable=False)
    added_by = Column(String(36), nullable=True)
    added_at = Column(DateTime, server_default=func.now())

    drive = relationship("Drive", back_populates="certifications")
    certification = relationship("Certification", back_populates="drive_certifications")

class ExamSlot(Base):
    __tablename__ = "exam_slots"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    drive_id = Column(String(36), ForeignKey("drives.id"), nullable=False)
    slot_datetime = Column(DateTime, nullable=False)
    is_booked = Column(Boolean, default=False)
    booked_by_reg_id = Column(String(36), nullable=True)

    drive = relationship("Drive", back_populates="slots")

class ExamSession(Base):
    __tablename__ = "exam_sessions"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    registration_id = Column(String(36), ForeignKey("registrations.id"))
    voucher_code_entered = Column(String(100), nullable=True)
    started_at = Column(DateTime, nullable=True)
    submitted_at = Column(DateTime, nullable=True)
    status = Column(String(20), default="pending")

class UserCertificate(Base):
    __tablename__ = "user_certificates"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    user_id = Column(String(36), ForeignKey("users.id"))
    registration_id = Column(String(36), ForeignKey("registrations.id"))
    drive_id = Column(String(36), ForeignKey("drives.id"))
    cert_id = Column(String(36), nullable=True)
    cert_name = Column(String(200), nullable=False)
    issued_date = Column(DateTime, nullable=False)
    expiry_date = Column(DateTime, nullable=False)
    pdf_url = Column(String(500), nullable=True)
    status = Column(String(20), default="active")