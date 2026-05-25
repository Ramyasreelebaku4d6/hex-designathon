import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings

def send_email(to_email: str, subject: str, body: str):
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_USER
        msg["To"] = to_email

        html_body = MIMEText(body, "html")
        msg.attach(html_body)

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, to_email, msg.as_string())

        print(f"Email sent to {to_email}")
    except Exception as e:
        print(f"Email failed: {e}")

def send_ack_email(
    to_email: str,
    name: str,
    drive_name: str,
    registration_id: str
):
    subject = f"Registration Confirmed — {drive_name}"
    body = f"""
    <html><body>
    <h2>Hi {name},</h2>
    <p>Your registration for <strong>{drive_name}</strong> has been received.</p>
    <p><strong>Registration ID:</strong> {registration_id}</p>
    <p>You will be notified once eligibility is evaluated.</p>
    <p>To check your status anytime, use your Registration ID.</p>
    <br/>
    <p>Regards,<br/>Maverick Certification Hub</p>
    </body></html>
    """
    send_email(to_email, subject, body)

def send_voucher_email(
    to_email: str,
    name: str,
    vendor: str,
    tokenized_link: str,
    expiry_date: str
):
    subject = f"Your Certification Voucher — {vendor}"
    body = f"""
    <html><body>
    <h2>Congratulations {name}!</h2>
    <p>You have passed your assessment. Here is your voucher.</p>
    <p><strong>Vendor:</strong> {vendor}</p>
    <p><strong>Expires:</strong> {expiry_date}</p>
    <p>
        <a href="{tokenized_link}" 
           style="background:#0078d4;color:white;padding:10px 20px;
                  text-decoration:none;border-radius:5px;">
            Redeem Voucher
        </a>
    </p>
    <p style="color:red;">
        This link can only be used once. Do not share it.
    </p>
    <br/>
    <p>Regards,<br/>Maverick Certification Hub</p>
    </body></html>
    """
    send_email(to_email, subject, body)

def send_reminder_email(
    to_email: str,
    name: str,
    vendor: str,
    days_left: int,
    tokenized_link: str
):
    subject = f"Voucher Expiry Reminder — {days_left} days left"
    body = f"""
    <html><body>
    <h2>Hi {name},</h2>
    <p>Your <strong>{vendor}</strong> voucher expires in 
       <strong>{days_left} days</strong>.</p>
    <p>Please redeem it before it expires.</p>
    <p>
        <a href="{tokenized_link}"
           style="background:#0078d4;color:white;padding:10px 20px;
                  text-decoration:none;border-radius:5px;">
            Redeem Now
        </a>
    </p>
    <br/>
    <p>Regards,<br/>Maverick Certification Hub</p>
    </body></html>
    """
    send_email(to_email, subject, body)

def send_approval_request_email(
    to_email: str,
    approver_name: str,
    candidate_name: str,
    exam_track: str,
    drive_name: str,
    registration_id: str,
    ai_score: float,
    ai_reasons: str,
    approval_url: str
):
    subject = f"Action Required — Eligibility Approval for {candidate_name}"
    body = f"""
    <html><body style="font-family: Segoe UI, sans-serif; color: #111;">
    <h2>Hi {approver_name},</h2>
    <p>A candidate requires your approval for certification eligibility.</p>

    <table style="border-collapse:collapse; width:100%; margin:16px 0;">
      <tr style="background:#f3f4f6;">
        <td style="padding:8px 12px; font-weight:600;">Candidate</td>
        <td style="padding:8px 12px;">{candidate_name}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px; font-weight:600;">Drive</td>
        <td style="padding:8px 12px;">{drive_name}</td>
      </tr>
      <tr style="background:#f3f4f6;">
        <td style="padding:8px 12px; font-weight:600;">Exam Track</td>
        <td style="padding:8px 12px;">{exam_track}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px; font-weight:600;">AI Score</td>
        <td style="padding:8px 12px;">{round(ai_score * 100)}%</td>
      </tr>
      <tr style="background:#f3f4f6;">
        <td style="padding:8px 12px; font-weight:600;">AI Reasoning</td>
        <td style="padding:8px 12px;">{ai_reasons}</td>
      </tr>
    </table>

    <p>Please review and take action:</p>
    <div style="margin:20px 0;">
      <a href="{approval_url}?decision=eligible&reg_id={registration_id}"
         style="background:#22c55e;color:white;padding:10px 24px;
                text-decoration:none;border-radius:6px;margin-right:12px;">
        ✓ Approve
      </a>
      <a href="{approval_url}?decision=ineligible&reg_id={registration_id}"
         style="background:#ef4444;color:white;padding:10px 24px;
                text-decoration:none;border-radius:6px;">
        ✗ Reject
      </a>
    </div>

    <p style="color:#6b7280;font-size:12px;">
      Or log in to the portal to review: 
      <a href="http://localhost:5173/eligibility">Maverick Hub</a>
    </p>

    <br/>
    <p>Regards,<br/>Maverick Certification Hub</p>
    </body></html>
    """
    send_email(to_email, subject, body)