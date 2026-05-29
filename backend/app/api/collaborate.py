from fastapi import APIRouter
from pydantic import BaseModel
from openai import OpenAI
from ..config import settings

router = APIRouter(prefix="/collaborate", tags=["collaborate"])


class ChatMessage(BaseModel):
    role: str
    text: str


class ChatRequest(BaseModel):
    role: str
    message: str
    history: list[ChatMessage] = []


SYSTEM_PROMPT = """You are an AI facilitator embedded in a healthcare facility design platform. Your role is to bridge communication between:
- Doctors and clinical staff (who speak in clinical/operational terms)
- Architects (who speak in spatial/design terms)

When a doctor speaks: translate their clinical needs into spatial requirements, highlight FGI guidelines, suggest adjacencies.
When an architect speaks: explain design implications for patient outcomes, flag clinical workflow concerns.

Be concise — 2-3 sentences max. Be specific and actionable.
Use clinical and architectural vocabulary appropriately.
If relevant, mention specific FGI Guideline requirements, infection control zones, or patient flow considerations."""


@router.post("/chat")
def chat(req: ChatRequest):
    client = OpenAI(api_key=settings.openai_api_key)

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    for msg in req.history[-12:]:
        oai_role = "user" if msg.role in ("doctor", "architect") else "assistant"
        messages.append({
            "role": oai_role,
            "content": f"[{msg.role.upper()}]: {msg.text}",
        })

    messages.append({
        "role": "user",
        "content": f"[{req.role.upper()}]: {req.message}",
    })

    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        max_tokens=220,
        temperature=0.7,
    )

    return {"response": resp.choices[0].message.content}
