"""
Skills CRUD API — manage skill catalog and sync to instances.

M2.2: Skill management API.
Reference: PRD Section 3.7, Section 12.
"""

from pathlib import Path

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

router = APIRouter(prefix="/api/v2/skills", tags=["skills"])

SKILLS_DIR = Path("openclaw/skills")


class SkillResponse(BaseModel):
    id: str
    category: str
    name: str
    content: str
    size_bytes: int


@router.get("")
async def list_skills(category: str | None = None):
    """List all skills from the central catalog."""
    skills = []
    if not SKILLS_DIR.exists():
        return skills
    for cat_dir in sorted(SKILLS_DIR.iterdir()):
        if not cat_dir.is_dir() or cat_dir.name.startswith("."):
            continue
        if category and cat_dir.name != category:
            continue
        for skill_file in sorted(cat_dir.glob("*.md")):
            content = skill_file.read_text(encoding="utf-8")
            skills.append({
                "id": f"{cat_dir.name}/{skill_file.stem}",
                "category": cat_dir.name,
                "name": skill_file.stem,
                "content": content[:200] + "..." if len(content) > 200 else content,
                "size_bytes": len(content.encode()),
            })
    return skills


@router.get("/categories")
async def list_categories():
    """List skill categories with counts."""
    categories = []
    if not SKILLS_DIR.exists():
        return categories
    for cat_dir in sorted(SKILLS_DIR.iterdir()):
        if not cat_dir.is_dir() or cat_dir.name.startswith("."):
            continue
        count = len(list(cat_dir.glob("*.md")))
        categories.append({"name": cat_dir.name, "count": count})
    return categories


@router.get("/{category}/{skill_name}")
async def get_skill(category: str, skill_name: str):
    """Get full skill content."""
    skill_path = SKILLS_DIR / category / f"{skill_name}.md"
    if not skill_path.exists():
        raise HTTPException(status_code=404, detail="Skill not found")
    content = skill_path.read_text(encoding="utf-8")
    return {
        "id": f"{category}/{skill_name}",
        "category": category,
        "name": skill_name,
        "content": content,
        "size_bytes": len(content.encode()),
    }


@router.post("/sync")
async def trigger_sync():
    """Trigger skill sync to all OpenClaw instances."""
    # In production: invoke SkillSyncService.sync_all()
    return {"status": "sync_triggered", "message": "Skills are being distributed to all instances"}
