import json
import random
from openai import OpenAI
from ..config import settings

DEPT_COLORS = {
    "emergency": "#ef4444",
    "inpatient": "#3b82f6",
    "outpatient": "#10b981",
    "diagnostic": "#f59e0b",
    "surgery": "#8b5cf6",
    "icu": "#ec4899",
    "support": "#6b7280",
    "admin": "#14b8a6",
    "public": "#f97316",
    "pharmacy": "#84cc16",
    "radiology": "#a78bfa",
    "laboratory": "#fbbf24",
    "rehabilitation": "#34d399",
    "default": "#64748b",
}

EDGE_STYLES = {
    "required": {"strokeWidth": 3, "stroke": "#ef4444", "animated": True},
    "preferred": {"strokeWidth": 2, "stroke": "#3b82f6", "animated": False},
    "avoid": {"strokeWidth": 1, "stroke": "#9ca3af", "style": "dashed", "animated": False},
}


def generate_bubble_diagram(requirements_text: str, site_context=None) -> dict:
    client = OpenAI(api_key=settings.openai_api_key)

    site_info = ""
    if site_context:
        site_info = f"\nSite Context:\n{json.dumps(site_context, indent=2)}"

    prompt = f"""You are an expert healthcare facility planner. Generate a detailed bubble diagram program for a healthcare facility.

Client Requirements:
{requirements_text}
{site_info}

Return ONLY valid JSON with this exact structure:
{{
  "departments": [
    {{
      "id": "dept_emergency",
      "name": "Emergency Department",
      "type": "emergency",
      "area_sqm": 800,
      "staff_count": 25,
      "beds": 20,
      "description": "24/7 emergency care with trauma bays",
      "zone": "clinical",
      "floor_preference": "ground",
      "notes": "needs direct ambulance access"
    }}
  ],
  "adjacencies": [
    {{
      "from": "dept_emergency",
      "to": "dept_radiology",
      "strength": "required",
      "reason": "rapid imaging for trauma"
    }}
  ],
  "zones": [
    {{"id": "zone_public", "name": "Public Zone", "color": "#e0f2fe"}},
    {{"id": "zone_clinical", "name": "Clinical Zone", "color": "#fef3c7"}},
    {{"id": "zone_staff", "name": "Staff Zone", "color": "#f0fdf4"}},
    {{"id": "zone_service", "name": "Service Zone", "color": "#fdf4ff"}}
  ],
  "total_area_sqm": 5000,
  "total_beds": 100,
  "summary": "Brief description of the facility program"
}}

Include 8-15 departments typical for the described facility. Use realistic healthcare facility areas."""

    response = client.chat.completions.create(
        model=settings.openai_model,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.4,
    )

    program = json.loads(response.choices[0].message.content)
    nodes, edges = program_to_reactflow(program)
    return {"program": program, "nodes": nodes, "edges": edges}


def program_to_reactflow(program: dict):
    departments = program.get("departments", [])
    adjacencies = program.get("adjacencies", [])

    # Layout in a grid with some spacing
    cols = max(3, int(len(departments) ** 0.5) + 1)
    nodes = []
    for i, dept in enumerate(departments):
        color = DEPT_COLORS.get(dept.get("type", "default"), DEPT_COLORS["default"])
        # Scale bubble size by area: 80-200px diameter
        area = dept.get("area_sqm", 500)
        size = max(80, min(200, int(area ** 0.5 * 3.5)))
        row, col = divmod(i, cols)
        nodes.append({
            "id": dept["id"],
            "type": "bubbleNode",
            "position": {"x": col * 260, "y": row * 260},
            "data": {
                **dept,
                "color": color,
                "size": size,
            },
        })

    edges = []
    for adj in adjacencies:
        style = EDGE_STYLES.get(adj.get("strength", "preferred"), EDGE_STYLES["preferred"])
        edges.append({
            "id": f"e-{adj['from']}-{adj['to']}",
            "source": adj["from"],
            "target": adj["to"],
            "type": "smoothstep",
            "label": adj.get("reason", ""),
            "style": style,
            "data": {"strength": adj.get("strength", "preferred")},
        })

    return nodes, edges
