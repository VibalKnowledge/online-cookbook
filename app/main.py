"""FastAPI backend for the online cookbook."""

import json
import logging
import os
import re
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.database import (
    get_all_summaries,
    get_random_recipes,
    get_recipe,
    init_db,
    search_by_ids,
    search_by_name,
)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Load .env from project root (one level up from this file's directory)
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path)

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")

logger = logging.getLogger("cookbook")

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="Joanne's Online Cookbook", version="1.0.0")

STATIC_DIR = Path(__file__).resolve().parent / "static"


@app.on_event("startup")
def on_startup() -> None:
    """Ensure the DB schema exists on first run."""
    init_db()


# Mount static files *after* defining API routes so the API takes priority.
# We mount at /static so it doesn't shadow the root route.
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class CravingSearchRequest(BaseModel):
    query: str
    mode: str = "craving"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/")
async def index():
    """Serve the main SPA page."""
    index_file = STATIC_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="index.html not found")
    return FileResponse(str(index_file))


@app.get("/api/search")
async def api_search_get(
    q: str = Query("", description="Search query"),
    mode: str = Query("name", description="Search mode"),
    limit: int = Query(20, ge=1, le=100),
):
    """Name-based search using FTS5."""
    if not q.strip():
        return {"results": []}
    results = search_by_name(q, limit=limit)
    return {"results": results}


@app.post("/api/search")
async def api_search_post(body: CravingSearchRequest):
    """
    Craving / AI-assisted search.

    Strategy (keeps token usage low):
      1. Extract keywords from the craving with simple heuristics.
      2. Use FTS5 to narrow to ~100 candidate recipes.
      3. If a Gemini API key is available, ask Gemini to rank those candidates.
      4. Otherwise, just return the FTS5 results.
    """
    query = body.query.strip()
    if not query:
        return {"results": []}

    # If mode is plain "name", just do FTS
    if body.mode == "name":
        return {"results": search_by_name(query, limit=20)}

    # --- Craving mode ---
    # Step 1: Pre-filter with FTS to get candidates
    candidates = search_by_name(query, limit=100)

    if not candidates:
        # Broaden: try individual words
        for word in query.split():
            if len(word) >= 3:
                candidates.extend(search_by_name(word, limit=30))
        # Deduplicate
        seen = set()
        unique = []
        for c in candidates:
            if c["id"] not in seen:
                seen.add(c["id"])
                unique.append(c)
        candidates = unique[:100]

    if not candidates:
        return {"results": []}

    # Step 2: If no API key, return FTS results directly
    if not GOOGLE_API_KEY:
        logger.info("No GOOGLE_API_KEY set – returning FTS results for craving search")
        return {"results": candidates[:15]}

    # Step 3: Ask Gemini to rank the candidates
    ranked = await _gemini_rank(query, candidates)
    return {"results": ranked}


# ---------------------------------------------------------------------------
# Gemini integration
# ---------------------------------------------------------------------------

async def _gemini_rank(query: str, candidates: list[dict]) -> list[dict]:
    """
    Send candidate recipes to Gemini Flash and ask it to pick the best
    10-15 matches for the user's craving.
    """
    try:
        import google.generativeai as genai

        genai.configure(api_key=GOOGLE_API_KEY)
        model = genai.GenerativeModel("gemini-2.0-flash")

        # Build compact recipe list for the prompt
        recipe_lines = "\n".join(
            f"{r['id']} | {r['title']} | {r.get('category', '')} | {r.get('subcategory', '')}"
            for r in candidates
        )

        prompt = (
            "You are a recipe recommendation assistant. "
            "Given a user's craving/mood description and a list of available recipes, "
            "return the IDs of the 10-15 best matching recipes.\n\n"
            f"User wants: {query}\n\n"
            "Available recipes (format: ID | Title | Category | Subcategory):\n"
            f"{recipe_lines}\n\n"
            "Return ONLY a JSON array of recipe IDs, e.g. [42, 103, 567]. No explanation."
        )

        response = model.generate_content(prompt)
        text = response.text.strip()

        # Parse the JSON array from the response
        # Gemini sometimes wraps in ```json ... ``` blocks
        json_match = re.search(r"\[[\s\S]*?\]", text)
        if not json_match:
            logger.warning("Gemini returned unparseable response: %s", text[:200])
            return candidates[:15]

        ids = json.loads(json_match.group())
        ids = [int(i) for i in ids if isinstance(i, (int, float, str))]

        if not ids:
            return candidates[:15]

        # Fetch full recipes in the ranked order
        ranked = search_by_ids(ids)
        return ranked if ranked else candidates[:15]

    except ImportError:
        logger.warning("google-generativeai not installed – falling back to FTS")
        return candidates[:15]
    except Exception:
        logger.exception("Gemini API call failed – falling back to FTS")
        return candidates[:15]


# ---------------------------------------------------------------------------
# Single recipe detail
# ---------------------------------------------------------------------------

@app.get("/api/recipe/{recipe_id}")
async def api_recipe_detail(recipe_id: int):
    """Return a single recipe by ID."""
    recipe = get_recipe(recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe


# ---------------------------------------------------------------------------
# Random recipes (homepage)
# ---------------------------------------------------------------------------

@app.get("/api/random")
async def api_random(limit: int = Query(10, ge=1, le=50)):
    """Return random recipes for the home page."""
    return {"results": get_random_recipes(limit)}
