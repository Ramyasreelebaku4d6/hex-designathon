from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.units import inch, cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.pdfgen import canvas
from datetime import datetime
import io
import os

def generate_certificate_pdf(
    candidate_name: str,
    cert_name: str,
    drive_name: str,
    issued_date: datetime,
    expiry_date: datetime,
    certificate_id: str,
) -> bytes:
    buffer = io.BytesIO()

    # Page setup — landscape A4
    page_width, page_height = landscape(A4)
    c = canvas.Canvas(buffer, pagesize=landscape(A4))

    # ── Background ───────────────────────────────────────────────────
    c.setFillColor(colors.HexColor("#0A1628"))
    c.rect(0, 0, page_width, page_height, fill=1, stroke=0)

    # ── Gold border ──────────────────────────────────────────────────
    c.setStrokeColor(colors.HexColor("#C9A84C"))
    c.setLineWidth(3)
    c.rect(20, 20, page_width - 40, page_height - 40, fill=0, stroke=1)
    c.setLineWidth(1)
    c.rect(28, 28, page_width - 56, page_height - 56, fill=0, stroke=1)

    # ── Header — Hexaware ────────────────────────────────────────────
    c.setFillColor(colors.HexColor("#C9A84C"))
    c.setFont("Helvetica-Bold", 13)
    c.drawCentredString(page_width / 2, page_height - 70, "HEXAWARE TECHNOLOGIES")

    c.setFillColor(colors.HexColor("#8B9BB4"))
    c.setFont("Helvetica", 9)
    c.drawCentredString(
        page_width / 2, page_height - 86,
        "Maverick Certification Hub  ·  MAP Certification Drive"
    )

    # ── Divider line ─────────────────────────────────────────────────
    c.setStrokeColor(colors.HexColor("#C9A84C"))
    c.setLineWidth(0.5)
    c.line(80, page_height - 100, page_width - 80, page_height - 100)

    # ── Certificate of Achievement ───────────────────────────────────
    c.setFillColor(colors.HexColor("#FFFFFF"))
    c.setFont("Helvetica", 11)
    c.drawCentredString(
        page_width / 2, page_height - 135,
        "CERTIFICATE OF ACHIEVEMENT"
    )

    # ── This is to certify ───────────────────────────────────────────
    c.setFillColor(colors.HexColor("#8B9BB4"))
    c.setFont("Helvetica", 10)
    c.drawCentredString(
        page_width / 2, page_height - 165,
        "This is to proudly certify that"
    )

    # ── Candidate name ───────────────────────────────────────────────
    c.setFillColor(colors.HexColor("#C9A84C"))
    c.setFont("Helvetica-Bold", 32)
    c.drawCentredString(page_width / 2, page_height - 210, candidate_name)

    # ── Underline ────────────────────────────────────────────────────
    name_width = c.stringWidth(candidate_name, "Helvetica-Bold", 32)
    c.setStrokeColor(colors.HexColor("#C9A84C"))
    c.setLineWidth(0.8)
    c.line(
        page_width / 2 - name_width / 2,
        page_height - 216,
        page_width / 2 + name_width / 2,
        page_height - 216
    )

    # ── Has successfully completed ───────────────────────────────────
    c.setFillColor(colors.HexColor("#8B9BB4"))
    c.setFont("Helvetica", 10)
    c.drawCentredString(
        page_width / 2, page_height - 245,
        "has successfully completed the certification"
    )

    # ── Certification name ───────────────────────────────────────────
    c.setFillColor(colors.HexColor("#FFFFFF"))
    c.setFont("Helvetica-Bold", 20)
    c.drawCentredString(page_width / 2, page_height - 278, cert_name)

    # ── Drive name ───────────────────────────────────────────────────
    c.setFillColor(colors.HexColor("#8B9BB4"))
    c.setFont("Helvetica", 9)
    c.drawCentredString(
        page_width / 2, page_height - 300,
        f"as part of  {drive_name}"
    )

    # ── Divider ──────────────────────────────────────────────────────
    c.setStrokeColor(colors.HexColor("#1E3A5F"))
    c.setLineWidth(0.5)
    c.line(80, page_height - 320, page_width - 80, page_height - 320)

    # ── Date boxes ───────────────────────────────────────────────────
    box_y = page_height - 370
    box_w = 160
    box_h = 50

    # Issued date box
    issued_x = page_width / 2 - 180
    c.setFillColor(colors.HexColor("#0D1F3C"))
    c.roundRect(issued_x, box_y, box_w, box_h, 6, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#8B9BB4"))
    c.setFont("Helvetica", 8)
    c.drawCentredString(issued_x + box_w / 2, box_y + 34, "ISSUED ON")
    c.setFillColor(colors.HexColor("#FFFFFF"))
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(
        issued_x + box_w / 2,
        box_y + 16,
        issued_date.strftime("%d %B %Y")
    )

    # Expiry date box
    expiry_x = page_width / 2 + 20
    c.setFillColor(colors.HexColor("#0D1F3C"))
    c.roundRect(expiry_x, box_y, box_w, box_h, 6, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#8B9BB4"))
    c.setFont("Helvetica", 8)
    c.drawCentredString(expiry_x + box_w / 2, box_y + 34, "VALID UNTIL")
    c.setFillColor(colors.HexColor("#C9A84C"))
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(
        expiry_x + box_w / 2,
        box_y + 16,
        expiry_date.strftime("%d %B %Y")
    )

    # ── Certificate ID ───────────────────────────────────────────────
    c.setFillColor(colors.HexColor("#4A5568"))
    c.setFont("Helvetica", 7)
    c.drawCentredString(
        page_width / 2,
        box_y - 20,
        f"Certificate ID: {certificate_id.upper()}"
    )

    # ── Bottom signature area ────────────────────────────────────────
    sig_y = 65
    c.setStrokeColor(colors.HexColor("#C9A84C"))
    c.setLineWidth(0.5)
    c.line(80, sig_y + 20, 230, sig_y + 20)
    c.setFillColor(colors.HexColor("#8B9BB4"))
    c.setFont("Helvetica", 8)
    c.drawCentredString(155, sig_y + 8, "Authorized Signatory")
    c.setFillColor(colors.HexColor("#FFFFFF"))
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(155, sig_y - 4, "L&D Mavericks, Hexaware")

    # ── Stamp / seal placeholder ─────────────────────────────────────
    c.setStrokeColor(colors.HexColor("#C9A84C"))
    c.setLineWidth(1.5)
    c.circle(page_width / 2, sig_y + 10, 28, fill=0, stroke=1)
    c.setFillColor(colors.HexColor("#C9A84C"))
    c.setFont("Helvetica-Bold", 7)
    c.drawCentredString(page_width / 2, sig_y + 14, "HEXAWARE")
    c.drawCentredString(page_width / 2, sig_y + 4, "CERTIFIED")

    # ── Validity badge ───────────────────────────────────────────────
    now = datetime.utcnow()
    is_active = expiry_date > now
    badge_color = "#1D9E75" if is_active else "#E24B4A"
    badge_text = "ACTIVE" if is_active else "EXPIRED"

    c.setFillColor(colors.HexColor(badge_color))
    c.roundRect(
        page_width - 160, sig_y - 5,
        80, 30, 4, fill=1, stroke=0
    )
    c.setFillColor(colors.HexColor("#FFFFFF"))
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(page_width - 120, sig_y + 8, badge_text)

    c.save()
    buffer.seek(0)
    return buffer.read()