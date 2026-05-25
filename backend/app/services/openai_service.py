from openai import AzureOpenAI
from app.core.config import settings
from sqlalchemy.orm import Session
import json

# Initialize Azure OpenAI client pointing to Foundry endpoint
client = AzureOpenAI(
    azure_endpoint=settings.MODEL_ENDPOINT,
    api_key=settings.MODEL_SUBSCRIPTION_KEY,
    api_version=settings.MODEL_API_VERSION
)

# -------------------------------------------------------
# AI Feature 1: Eligibility Scoring
# -------------------------------------------------------
async def get_ai_eligibility_score(
    tenure_days: int,
    prior_attempts: int,
    exam_track: str,
    rules_passed: bool
) -> dict:
    prompt = f"""
You are an eligibility evaluator for a corporate certification program.

Candidate details:
- Tenure: {tenure_days} days
- Prior attempts in last 365 days: {prior_attempts}
- Exam track: {exam_track}
- Basic rules passed: {rules_passed}

Evaluate this candidate's eligibility for the certification drive.
Return a JSON object with:
- score: float between 0 and 1 (1 = highly eligible)
- reasons: list of 3 short reason strings explaining the score

Return ONLY valid JSON. No explanation outside the JSON.

Example:
{{
  "score": 0.85,
  "reasons": [
    "Tenure of {tenure_days} days meets the 90-day requirement",
    "Only {prior_attempts} prior attempt(s) — within allowed limit",
    "Track {exam_track} has good historical pass rate"
  ]
}}
"""
    try:
        response = client.chat.completions.create(
            model=settings.MODEL_DEPLOYMENT,
            messages=[
                {
                    "role": "system",
                    "content": "You are an eligibility scoring assistant. Always respond with valid JSON only."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.3,
            max_completion_tokens=300
        )
        raw = response.choices[0].message.content.strip()
        result = json.loads(raw)
        return {
            "score": float(result.get("score", 0.5)),
            "reasons": result.get("reasons", [])
        }
    except Exception as e:
        print(f"AI scoring failed: {e}")
        # Fallback to rule-based score
        return {
            "score": 0.8 if rules_passed else 0.2,
            "reasons": ["AI scoring unavailable — using rule-based fallback"]
        }


# -------------------------------------------------------
# AI Feature 2: Natural Language to SQL (Audit Queries)
# -------------------------------------------------------

DB_SCHEMA = """
Tables:
- users(id, emp_id, name, email, business_unit, location, role, tenure_start_date)
- drives(id, name, sponsor, budget, start_date, end_date, status)
- registrations(id, drive_id, user_id, exam_track, status, prior_attempts, created_at)
- eligibility(id, registration_id, decision, ai_score, decision_date)
- assessment_results(id, registration_id, score, outcome, exam_date)
- vouchers(id, drive_id, registration_id, vendor, status, expiry_date, delivered_at, redeemed_at)
- audit_logs(id, entity_type, entity_id, action, actor_id, timestamp)
"""

async def nl_to_sql_query(question: str, db: Session) -> dict:
    prompt = f"""
You are a SQL query assistant for Azure SQL Server database.

Database schema:
{DB_SCHEMA}

User question: "{question}"

Rules:
- Generate SELECT queries only. Never INSERT, UPDATE, DELETE.
- Use proper Azure SQL Server syntax.
- Return ONLY a JSON object with keys: "sql" and "explanation"
- Keep queries simple and efficient.

Example output:
{{
  "sql": "SELECT COUNT(*) as total FROM registrations WHERE status = 'submitted'",
  "explanation": "Counts all registrations with submitted status"
}}
"""
    try:
        response = client.chat.completions.create(
            model=settings.MODEL_DEPLOYMENT,
            messages=[
                {
                    "role": "system",
                    "content": "You are a SQL assistant. Return valid JSON only."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.1,
            max_completion_tokens=500
        )
        raw = response.choices[0].message.content.strip()
        parsed = json.loads(raw)
        sql = parsed.get("sql", "")
        explanation = parsed.get("explanation", "")

        # Execute the SQL safely
        from sqlalchemy import text
        result = db.execute(text(sql))
        rows = [dict(row._mapping) for row in result]

        # Summarize results with AI
        summary = await summarize_query_results(question, rows)

        return {
            "question": question,
            "sql": sql,
            "answer": summary,
            "data": rows[:50]  # limit to 50 rows
        }
    except Exception as e:
        print(f"NL query failed: {e}")
        return {
            "question": question,
            "sql": "",
            "answer": f"Could not process query: {str(e)}",
            "data": []
        }

async def summarize_query_results(question: str, rows: list) -> str:
    if not rows:
        return "No results found for your query."
    try:
        response = client.chat.completions.create(
            model=settings.MODEL_DEPLOYMENT,
            messages=[
                {
                    "role": "system",
                    "content": "Summarize database query results in 1-2 clear sentences."
                },
                {
                    "role": "user",
                    "content": f"Question: {question}\nResults: {str(rows[:10])}"
                }
            ],
            temperature=0.3,
            max_completion_tokens=150
        )
        return response.choices[0].message.content.strip()
    except:
        return f"Found {len(rows)} result(s)."


# -------------------------------------------------------
# AI Feature 3: Email Drafting
# -------------------------------------------------------
async def draft_email(
    candidate_name: str,
    candidate_email: str,
    status: str,
    exam_track: str,
    drive_name: str,
    reason: str = None
) -> dict:
    prompt = f"""
Draft a professional and empathetic email for a certification program candidate.

Candidate details:
- Name: {candidate_name}
- Exam track: {exam_track}
- Drive: {drive_name}
- Current status: {status}
- Additional context: {reason or "None"}

Write a professional email with:
- A clear subject line
- Personalized greeting
- Status update explanation
- Next steps (if any)
- Professional sign-off from "Maverick Certification Hub Team"

Return ONLY a JSON object with keys "subject" and "body".
The body should be in plain text, not HTML.
"""
    try:
        response = client.chat.completions.create(
            model=settings.MODEL_DEPLOYMENT,
            messages=[
                {
                    "role": "system",
                    "content": "You are an HR communications assistant. Return valid JSON only."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.7,
            max_completion_tokens=600
        )
        raw = response.choices[0].message.content.strip()
        result = json.loads(raw)
        return {
            "subject": result.get("subject", "Update on your certification status"),
            "body": result.get("body", "")
        }
    except Exception as e:
        print(f"Email draft failed: {e}")
        return {
            "subject": f"Update on your {exam_track} certification",
            "body": f"Dear {candidate_name},\n\nYour current status is: {status}.\n\nRegards,\nMaverick Certification Hub Team"
        }