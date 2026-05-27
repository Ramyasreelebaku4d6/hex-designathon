import smtplib
import json
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings
from openai import AzureOpenAI

# ── AI client ────────────────────────────────────────────────────────
ai_client = AzureOpenAI(
    azure_endpoint=settings.MODEL_ENDPOINT,
    api_key=settings.MODEL_SUBSCRIPTION_KEY,
    api_version=settings.MODEL_API_VERSION
)

# ── Base email sender ─────────────────────────────────────────────────
def send_email(to_email: str, subject: str, body: str):
    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail, Email, To, Content

        sg = sendgrid.SendGridAPIClient(
            api_key=settings.SENDGRID_API_KEY
        )
        message = Mail(
            from_email=Email(
                settings.SMTP_USER,
                "Maverick Certification Hub"
            ),
            to_emails=To(to_email),
            subject=subject,
            html_content=Content("text/html", body)
        )
        response = sg.send(message)
        if response.status_code in [200, 201, 202]:
            print(f"[EMAIL] ✅ Sent to {to_email} — {subject}")
            return True
        else:
            print(f"[EMAIL] ❌ SendGrid error: {response.status_code} {response.body}")
            return False
    except Exception as e:
        print(f"[EMAIL] ❌ Failed: {e}")
        return False


# ── AI email generator ───────────────────────────────────────────────
def generate_ai_email(prompt: str, fallback_subject: str, fallback_body: str) -> dict:
    """Generate personalized email using GPT. Falls back to template if AI fails."""
    try:
        response = ai_client.chat.completions.create(
            model=settings.MODEL_DEPLOYMENT,
            messages=[
                {
                    "role": "system",
                    "content": """You are an HR communications specialist at Hexaware Technologies.
Generate professional, warm and personalized HTML emails for MAP certification drive candidates.
Return ONLY valid JSON with exactly two keys: 'subject' (string) and 'body' (HTML string).
Use inline CSS for styling. Sign off as 'L&D Mavericks Team, Hexaware Technologies'.
Do not include markdown or code blocks in response."""
                },
                {"role": "user", "content": prompt}
            ],
            max_completion_tokens=1000,
            temperature=0.7
        )
        raw = response.choices[0].message.content.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        result = json.loads(raw)
        return {
            "subject": result.get("subject", fallback_subject),
            "body": result.get("body", fallback_body)
        }
    except Exception as e:
        print(f"[AI-EMAIL] Generation failed: {e}, using fallback")
        return {
            "subject": fallback_subject,
            "body": fallback_body
        }


# ── Email base HTML wrapper ───────────────────────────────────────────
def wrap_html(content: str) -> str:
    return f"""
    <html>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; 
                 background-color: #f3f4f6; 
                 margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; 
                  background: white; border-radius: 12px;
                  overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0078d4, #106ebe); 
                    padding: 28px 32px;">
          <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">
            Maverick Certification Hub
          </h1>
          <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 13px;">
            MAP Certification Drive — Hexaware Technologies
          </p>
        </div>
        <!-- Content -->
        <div style="padding: 32px;">
          {content}
        </div>
        <!-- Footer -->
        <div style="background: #f8fafc; padding: 20px 32px; 
                    border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
            This is an automated email from Maverick Certification Hub.<br/>
            Hexaware Technologies — L&D Mavericks Team
          </p>
        </div>
      </div>
    </body>
    </html>
    """


# ── 1. Registration ACK email ─────────────────────────────────────────
def send_ack_email(
    to_email: str,
    name: str,
    drive_name: str,
    registration_id: str,
    exam_track: str = None,
    slot_datetime=None
):
    slot_str = ""
    if slot_datetime:
        try:
            from datetime import datetime
            if isinstance(slot_datetime, str):
                slot_datetime = datetime.fromisoformat(slot_datetime)
            slot_str = slot_datetime.strftime("%d %B %Y at %I:%M %p")
        except:
            slot_str = str(slot_datetime)

    prompt = f"""
Generate a warm registration confirmation email for a Hexaware certification drive candidate.

Details:
- Candidate name: {name}
- Certification: {exam_track or 'Not specified'}
- Drive name: {drive_name}
- Registration ID: {registration_id}
- Exam slot: {slot_str or 'To be confirmed'}

The email should:
1. Warmly welcome and confirm registration
2. Show registration ID in a highlighted box
3. List next steps: eligibility check → course completion → exam → certification
4. Be encouraging and professional
5. Mention they will receive updates at each step

Return JSON with 'subject' and 'body' (HTML with inline CSS).
"""

    fallback_body = wrap_html(f"""
        <h2 style="color: #111827; margin: 0 0 16px;">Hi {name}! 👋</h2>
        <p style="color: #374151; line-height: 1.6;">
            Your registration for <strong>{drive_name}</strong> has been 
            successfully confirmed.
        </p>
        <div style="background: #eff6ff; border-left: 4px solid #0078d4; 
                    padding: 16px; border-radius: 0 8px 8px 0; margin: 20px 0;">
            <p style="margin: 0; font-size: 12px; color: #6b7280;">Registration ID</p>
            <p style="margin: 4px 0 0; font-family: monospace; font-size: 14px; 
                      color: #0078d4; font-weight: 600;">{registration_id}</p>
        </div>
        <p style="color: #374151; line-height: 1.6;">
            <strong>What happens next?</strong>
        </p>
        <ol style="color: #374151; line-height: 2;">
            <li>Eligibility evaluation (AI-powered)</li>
            <li>Course completion</li>
            <li>Exam scheduling</li>
            <li>Certification issuance</li>
        </ol>
        <p style="color: #374151;">You will receive email updates at each step.</p>
        <br/>
        <p style="color: #374151;">Best regards,<br/>
        <strong>L&D Mavericks Team</strong><br/>
        Hexaware Technologies</p>
    """)

    result = generate_ai_email(
        prompt,
        fallback_subject=f"Registration Confirmed — {drive_name}",
        fallback_body=fallback_body
    )

    # Wrap AI body in template if it's plain HTML
    if "<html" not in result["body"].lower():
        result["body"] = wrap_html(result["body"])

    send_email(to_email, result["subject"], result["body"])


# ── 2. Eligibility decision email ─────────────────────────────────────
def send_eligibility_email(
    to_email: str,
    name: str,
    drive_name: str,
    exam_track: str,
    decision: str,
    ai_score: float,
    ai_reasons,
    reason: str = None
):
    prompt = f"""
Generate an eligibility decision email for a certification drive candidate.

Details:
- Name: {name}
- Certification: {exam_track}
- Drive: {drive_name}
- Decision: {decision}
- AI confidence score: {round(ai_score * 100)}%
- AI reasoning: {ai_reasons}
- Additional reason: {reason or 'None'}

If ELIGIBLE:
- Congratulate enthusiastically
- Show AI score as confidence indicator
- Explain next steps (complete course, then exam)
- Be motivating

If INELIGIBLE:
- Be empathetic and supportive
- Explain reason clearly
- Encourage them for future drives
- Mention they can contact coordinator

Return JSON with 'subject' and 'body' (HTML with inline CSS).
"""

    is_eligible = decision == "eligible"
    color = "#16a34a" if is_eligible else "#dc2626"
    bg = "#f0fdf4" if is_eligible else "#fef2f2"
    icon = "✅" if is_eligible else "❌"

    fallback_body = wrap_html(f"""
        <h2 style="color: #111827; margin: 0 0 16px;">Hi {name},</h2>
        <div style="background: {bg}; border: 1px solid {color}; 
                    border-radius: 8px; padding: 20px; margin: 20px 0; 
                    text-align: center;">
            <p style="font-size: 32px; margin: 0;">{icon}</p>
            <p style="color: {color}; font-size: 18px; font-weight: 600; margin: 8px 0 0;">
                {decision.upper()}
            </p>
            <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0;">
                AI Confidence: {round(ai_score * 100)}%
            </p>
        </div>
        <p style="color: #374151; line-height: 1.6;">
            Your eligibility for <strong>{drive_name}</strong> — 
            <strong>{exam_track}</strong> has been evaluated.
        </p>
        {f'<p style="color: #374151;">Next step: Complete your course to receive your exam voucher.</p>' if is_eligible else f'<p style="color: #374151;">Reason: {reason or "Policy criteria not met."}</p>'}
        <br/>
        <p style="color: #374151;">Best regards,<br/>
        <strong>L&D Mavericks Team</strong><br/>Hexaware Technologies</p>
    """)

    result = generate_ai_email(
        prompt,
        fallback_subject=f"Eligibility {'Approved' if is_eligible else 'Update'} — {drive_name}",
        fallback_body=fallback_body
    )

    if "<html" not in result["body"].lower():
        result["body"] = wrap_html(result["body"])

    send_email(to_email, result["subject"], result["body"])


# ── 3. Voucher delivery email ─────────────────────────────────────────
def send_voucher_email(
    to_email: str,
    name: str,
    vendor: str,
    tokenized_link: str,
    expiry_date: str,
    exam_track: str = None,
    drive_name: str = None
):
    prompt = f"""
Generate an exciting voucher delivery email for a certification exam candidate.

Details:
- Name: {name}
- Certification: {exam_track or 'Certification'}
- Drive: {drive_name or 'Certification Drive'}
- Vendor: {vendor}
- Voucher expiry: {expiry_date}
- Redemption link: {tokenized_link}

The email should:
1. Celebrate their achievement enthusiastically
2. Clearly explain the redemption process (click button once)
3. STRONGLY warn the link is ONE-TIME USE ONLY
4. Create urgency around the expiry date
5. Include the redemption button prominently
6. Provide 3 quick exam preparation tips

Include this exact HTML button:
<a href="{tokenized_link}" style="display:inline-block;background:#0078d4;
color:white;padding:14px 32px;text-decoration:none;border-radius:8px;
font-weight:600;font-size:15px;">Redeem Your Voucher →</a>

Return JSON with 'subject' and 'body' (HTML with inline CSS).
"""

    fallback_body = wrap_html(f"""
        <h2 style="color: #111827; margin: 0 0 8px;">
            🎉 Congratulations {name}!
        </h2>
        <p style="color: #374151; line-height: 1.6;">
            Your exam voucher for <strong>{exam_track or 'your certification'}</strong> 
            is ready to use.
        </p>
        <div style="background: #fefce8; border: 1px solid #fbbf24; 
                    border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0; font-size: 13px; color: #92400e;">
                <strong>⚠️ Important:</strong> This link is ONE-TIME USE ONLY. 
                Once clicked, it cannot be used again.
            </p>
        </div>
        <div style="text-align: center; margin: 28px 0;">
            <a href="{tokenized_link}" 
               style="display:inline-block;background:#0078d4;color:white;
                      padding:14px 32px;text-decoration:none;border-radius:8px;
                      font-weight:600;font-size:15px;">
                Redeem Your Voucher →
            </a>
        </div>
        <p style="color: #6b7280; font-size: 13px; text-align: center;">
            Vendor: <strong>{vendor}</strong> · Expires: <strong>{expiry_date}</strong>
        </p>
        <br/>
        <p style="color: #374151;">Best regards,<br/>
        <strong>L&D Mavericks Team</strong><br/>Hexaware Technologies</p>
    """)

    result = generate_ai_email(
        prompt,
        fallback_subject=f"🎉 Your {vendor} Exam Voucher is Ready — {exam_track or 'Certification'}",
        fallback_body=fallback_body
    )

    if "<html" not in result["body"].lower():
        result["body"] = wrap_html(result["body"])

    send_email(to_email, result["subject"], result["body"])


# ── 4. Voucher reminder email ─────────────────────────────────────────
def send_reminder_email(
    to_email: str,
    name: str,
    vendor: str,
    days_left: int,
    tokenized_link: str,
    exam_track: str = None
):
    urgency = "CRITICAL" if days_left <= 3 else "URGENT" if days_left <= 7 else "REMINDER"

    prompt = f"""
Generate a voucher expiry reminder email. Urgency level: {urgency}

Details:
- Name: {name}
- Certification: {exam_track or 'Certification'}
- Vendor: {vendor}
- Days until expiry: {days_left}
- Redemption link: {tokenized_link}

Tone based on urgency:
- CRITICAL (≤3 days): Very urgent, direct, action required NOW
- URGENT (≤7 days): Strong urgency, act soon
- REMINDER (>7 days): Friendly reminder, plan ahead

Include this exact HTML button:
<a href="{tokenized_link}" style="display:inline-block;background:#dc2626;
color:white;padding:14px 32px;text-decoration:none;border-radius:8px;
font-weight:600;font-size:15px;">Redeem Now — {days_left} Days Left</a>

Return JSON with 'subject' and 'body' (HTML with inline CSS).
"""

    color = "#dc2626" if days_left <= 3 else "#d97706" if days_left <= 7 else "#0078d4"
    emoji = "🚨" if days_left <= 3 else "⚠️" if days_left <= 7 else "📢"

    fallback_body = wrap_html(f"""
        <h2 style="color: #111827; margin: 0 0 16px;">
            {emoji} Hi {name},
        </h2>
        <div style="background: #fef2f2; border: 2px solid {color}; 
                    border-radius: 8px; padding: 20px; margin: 20px 0; 
                    text-align: center;">
            <p style="color: {color}; font-size: 28px; font-weight: 700; margin: 0;">
                {days_left} Days Left
            </p>
            <p style="color: #374151; margin: 8px 0 0;">
                Your <strong>{vendor}</strong> voucher is expiring soon!
            </p>
        </div>
        <div style="text-align: center; margin: 28px 0;">
            <a href="{tokenized_link}"
               style="display:inline-block;background:{color};color:white;
                      padding:14px 32px;text-decoration:none;border-radius:8px;
                      font-weight:600;font-size:15px;">
                Redeem Now — {days_left} Days Left
            </a>
        </div>
        <br/>
        <p style="color: #374151;">Best regards,<br/>
        <strong>L&D Mavericks Team</strong><br/>Hexaware Technologies</p>
    """)

    result = generate_ai_email(
        prompt,
        fallback_subject=f"{emoji} [{urgency}] Your voucher expires in {days_left} days — Act now",
        fallback_body=fallback_body
    )

    if "<html" not in result["body"].lower():
        result["body"] = wrap_html(result["body"])

    send_email(to_email, result["subject"], result["body"])


# ── 5. Approver notification email ───────────────────────────────────
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
    body = wrap_html(f"""
        <h2 style="color: #111827; margin: 0 0 16px;">
            Hi {approver_name},
        </h2>
        <p style="color: #374151; line-height: 1.6;">
            A candidate requires your approval for certification eligibility.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; 
                      border-radius: 8px; overflow: hidden;">
            <tr style="background: #f9fafb;">
                <td style="padding: 12px 16px; font-weight: 600; 
                           color: #374151; width: 40%; border-bottom: 1px solid #e5e7eb;">
                    Candidate
                </td>
                <td style="padding: 12px 16px; color: #111827; 
                           border-bottom: 1px solid #e5e7eb;">
                    {candidate_name}
                </td>
            </tr>
            <tr>
                <td style="padding: 12px 16px; font-weight: 600; 
                           color: #374151; border-bottom: 1px solid #e5e7eb;">
                    Drive
                </td>
                <td style="padding: 12px 16px; color: #111827; 
                           border-bottom: 1px solid #e5e7eb;">
                    {drive_name}
                </td>
            </tr>
            <tr style="background: #f9fafb;">
                <td style="padding: 12px 16px; font-weight: 600; 
                           color: #374151; border-bottom: 1px solid #e5e7eb;">
                    Certification
                </td>
                <td style="padding: 12px 16px; color: #111827; 
                           border-bottom: 1px solid #e5e7eb;">
                    {exam_track}
                </td>
            </tr>
            <tr>
                <td style="padding: 12px 16px; font-weight: 600; color: #374151;">
                    AI Score
                </td>
                <td style="padding: 12px 16px; color: #0078d4; font-weight: 600;">
                    {round(ai_score * 100)}% confidence
                </td>
            </tr>
        </table>
        <div style="background: #eff6ff; border-radius: 8px; 
                    padding: 16px; margin: 20px 0;">
            <p style="margin: 0; font-size: 13px; color: #1e40af; font-weight: 600;">
                AI Reasoning:
            </p>
            <p style="margin: 8px 0 0; color: #1e40af; font-size: 13px; line-height: 1.6;">
                {ai_reasons}
            </p>
        </div>
        <div style="text-align: center; margin: 28px 0;">
            <a href="{approval_url}"
               style="display:inline-block;background:#0078d4;color:white;
                      padding:14px 32px;text-decoration:none;border-radius:8px;
                      font-weight:600;font-size:15px;">
                Review in Portal →
            </a>
        </div>
        <br/>
        <p style="color: #374151;">Best regards,<br/>
        <strong>L&D Mavericks Team</strong><br/>Hexaware Technologies</p>
    """)
    send_email(to_email, subject, body)

# ── 6. Drive activation notification ─────────────────────────────────
def send_drive_activation_email(
    to_email: str,
    name: str,
    drive_name: str,
    certifications: list,
    end_date: str,
    portal_url: str
):
    cert_list = ", ".join(certifications) if certifications else "Various certifications"

    prompt = f"""
Generate an exciting drive activation announcement email.

Details:
- Recipient name: {name}
- Drive name: {drive_name}
- Available certifications: {cert_list}
- Registration deadline: {end_date}
- Portal URL: {portal_url}

The email should:
1. Announce the drive opening excitedly
2. List available certifications clearly
3. Mention the deadline urgency
4. Include a clear CTA button to register
5. Highlight the career benefit of certification

Include this button:
<a href="{portal_url}" style="display:inline-block;background:#0078d4;
color:white;padding:14px 32px;text-decoration:none;border-radius:8px;
font-weight:600;">Register Now →</a>

Return JSON with 'subject' and 'body' (HTML with inline CSS).
"""

    cert_items = "".join([
        f'<li style="padding:4px 0;color:#374151;">{c}</li>'
        for c in certifications
    ]) if certifications else "<li>Various certifications available</li>"

    fallback_body = wrap_html(f"""
        <h2 style="color:#111827;margin:0 0 8px;">
            🚀 Hi {name}!
        </h2>
        <p style="color:#374151;line-height:1.6;font-size:16px;">
            <strong>{drive_name}</strong> is now open for registration!
        </p>
        <div style="background:#eff6ff;border-radius:8px;
                    padding:20px;margin:20px 0;">
            <p style="margin:0 0 12px;font-weight:600;color:#1e40af;">
                Available Certifications:
            </p>
            <ul style="margin:0;padding-left:20px;">
                {cert_items}
            </ul>
        </div>
        <div style="background:#fef3c7;border-radius:8px;
                    padding:12px 16px;margin:16px 0;">
            <p style="margin:0;color:#92400e;font-size:13px;">
                ⏰ Registration closes: <strong>{end_date}</strong>
            </p>
        </div>
        <div style="text-align:center;margin:28px 0;">
            <a href="{portal_url}"
               style="display:inline-block;background:#0078d4;color:white;
                      padding:14px 32px;text-decoration:none;border-radius:8px;
                      font-weight:600;font-size:15px;">
                Register Now →
            </a>
        </div>
        <br/>
        <p style="color:#374151;">Best regards,<br/>
        <strong>L&D Mavericks Team</strong><br/>
        Hexaware Technologies</p>
    """)

    result = generate_ai_email(
        prompt,
        fallback_subject=f"🚀 New Drive Open — {drive_name} | Register Now",
        fallback_body=fallback_body
    )
    if "<html" not in result["body"].lower():
        result["body"] = wrap_html(result["body"])
    send_email(to_email, result["subject"], result["body"])


# ── 7. Certificate completion email with PDF ──────────────────────────
def send_certificate_completion_email(
    to_email: str,
    name: str,
    cert_name: str,
    drive_name: str,
    issued_date: str,
    expiry_date: str,
    certificate_id: str,
    download_url: str = None
):
    prompt = f"""
Generate a congratulatory certificate completion email.

Details:
- Name: {name}
- Certification earned: {cert_name}
- Drive: {drive_name}
- Issue date: {issued_date}
- Valid until: {expiry_date}
- Certificate ID: {certificate_id}

The email should:
1. Warmly congratulate on earning the certification
2. Show certificate details in a table
3. Mention 1-year validity
4. Encourage sharing on LinkedIn
5. Thank for participating in the drive

{"Include download button: <a href='" + download_url + "' style='display:inline-block;background:#16a34a;color:white;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:600;'>Download Certificate →</a>" if download_url else ""}

Return JSON with 'subject' and 'body' (HTML with inline CSS).
"""

    fallback_body = wrap_html(f"""
        <h2 style="color:#111827;margin:0 0 8px;">
            🎓 Congratulations {name}!
        </h2>
        <p style="color:#374151;line-height:1.6;">
            You have successfully earned your
            <strong>{cert_name}</strong> certification!
        </p>
        <div style="background:#f0fdf4;border:1px solid #16a34a;
                    border-radius:8px;padding:20px;margin:20px 0;">
            <table style="width:100%;border-collapse:collapse;">
                <tr>
                    <td style="padding:8px 0;color:#6b7280;font-size:13px;">
                        Certification
                    </td>
                    <td style="padding:8px 0;font-weight:600;color:#111827;">
                        {cert_name}
                    </td>
                </tr>
                <tr>
                    <td style="padding:8px 0;color:#6b7280;font-size:13px;">
                        Drive
                    </td>
                    <td style="padding:8px 0;color:#374151;">{drive_name}</td>
                </tr>
                <tr>
                    <td style="padding:8px 0;color:#6b7280;font-size:13px;">
                        Issued
                    </td>
                    <td style="padding:8px 0;color:#374151;">{issued_date}</td>
                </tr>
                <tr>
                    <td style="padding:8px 0;color:#6b7280;font-size:13px;">
                        Valid Until
                    </td>
                    <td style="padding:8px 0;font-weight:600;color:#16a34a;">
                        {expiry_date}
                    </td>
                </tr>
                <tr>
                    <td style="padding:8px 0;color:#6b7280;font-size:13px;">
                        Certificate ID
                    </td>
                    <td style="padding:8px 0;font-family:monospace;
                               font-size:12px;color:#6b7280;">
                        {certificate_id[:8].upper()}
                    </td>
                </tr>
            </table>
        </div>
        {f'<div style="text-align:center;margin:24px 0;"><a href="{download_url}" style="display:inline-block;background:#16a34a;color:white;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:600;">Download Certificate →</a></div>' if download_url else ''}
        <br/>
        <p style="color:#374151;">Best regards,<br/>
        <strong>L&D Mavericks Team</strong><br/>
        Hexaware Technologies</p>
    """)

    result = generate_ai_email(
        prompt,
        fallback_subject=f"🎓 Congratulations! Your {cert_name} Certificate is Ready",
        fallback_body=fallback_body
    )
    if "<html" not in result["body"].lower():
        result["body"] = wrap_html(result["body"])
    send_email(to_email, result["subject"], result["body"])

