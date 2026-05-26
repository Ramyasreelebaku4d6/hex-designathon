from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import (
    auth, drives, registrations,
    eligibility, results, vouchers,
    audit, dashboard
)
from app.scheduler import start_scheduler

from app.routers import (
    auth, drives, registrations,
    eligibility, results, vouchers,
    audit, dashboard, certifications, slots  # add these two
)
from app.routers import exam
from app.routers import microsoft_auth

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    start_scheduler()
    yield


app = FastAPI(
    title="Maverick Certification Hub",
    version="1.0.0",
    lifespan=lifespan,
)
# CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(drives.router, prefix="/api/drives", tags=["drives"])
app.include_router(registrations.router, prefix="/api/registrations", tags=["registrations"])
app.include_router(eligibility.router, prefix="/api/eligibility", tags=["eligibility"])
app.include_router(results.router, prefix="/api/results", tags=["results"])
app.include_router(vouchers.router, prefix="/api/vouchers", tags=["vouchers"])
app.include_router(audit.router, prefix="/api/audit", tags=["audit"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(
    certifications.router,
    prefix="/api/certifications",
    tags=["certifications"]
)
app.include_router(
    slots.router,
    prefix="/api/slots",
    tags=["slots"]
)
app.include_router(exam.router, prefix="/api/exam", tags=["exam"])
app.include_router(
    microsoft_auth.router,
    prefix="/api/auth/microsoft",
    tags=["microsoft-auth"]
)

@app.get("/")
def root():
    return {"message": "Maverick Certification Hub API is running"}