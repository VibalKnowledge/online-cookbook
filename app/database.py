"""SQLite database helper for the online cookbook."""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "recipes.db"


def _get_conn() -> sqlite3.Connection:
    """Return a connection with row_factory set to sqlite3.Row."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    return conn


def _row_to_dict(row: sqlite3.Row) -> dict:
    return dict(row)


# ---------------------------------------------------------------------------
# Schema bootstrap – called once on app startup
# ---------------------------------------------------------------------------

def init_db() -> None:
    """Create the recipes table and FTS5 virtual table if they don't exist."""
    conn = _get_conn()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS recipes (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            title        TEXT NOT NULL,
            category     TEXT,
            subcategory  TEXT,
            ingredients  TEXT,
            instructions TEXT,
            notes        TEXT,
            serves       TEXT,
            source_file  TEXT
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS recipes_fts USING fts5(
            title, category, subcategory, ingredients, instructions, notes,
            content='recipes', content_rowid='id'
        );

        CREATE TRIGGER IF NOT EXISTS recipes_ai AFTER INSERT ON recipes BEGIN
            INSERT INTO recipes_fts(rowid, title, category, subcategory,
                                    ingredients, instructions, notes)
            VALUES (new.id, new.title, new.category, new.subcategory,
                    new.ingredients, new.instructions, new.notes);
        END;

        CREATE TRIGGER IF NOT EXISTS recipes_ad AFTER DELETE ON recipes BEGIN
            INSERT INTO recipes_fts(recipes_fts, rowid, title, category,
                                    subcategory, ingredients, instructions, notes)
            VALUES ('delete', old.id, old.title, old.category, old.subcategory,
                    old.ingredients, old.instructions, old.notes);
        END;

        CREATE TRIGGER IF NOT EXISTS recipes_au AFTER UPDATE ON recipes BEGIN
            INSERT INTO recipes_fts(recipes_fts, rowid, title, category,
                                    subcategory, ingredients, instructions, notes)
            VALUES ('delete', old.id, old.title, old.category, old.subcategory,
                    old.ingredients, old.instructions, old.notes);
            INSERT INTO recipes_fts(rowid, title, category, subcategory,
                                    ingredients, instructions, notes)
            VALUES (new.id, new.title, new.category, new.subcategory,
                    new.ingredients, new.instructions, new.notes);
        END;
        """
    )
    conn.commit()
    conn.close()


def rebuild_fts() -> None:
    """Rebuild the FTS index from the recipes table (run after bulk inserts)."""
    conn = _get_conn()
    conn.execute("INSERT INTO recipes_fts(recipes_fts) VALUES('rebuild');")
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Query helpers
# ---------------------------------------------------------------------------

def search_by_name(query: str, limit: int = 20) -> list[dict]:
    """
    FTS5 fuzzy search across title, category, subcategory, ingredients.

    Tokenises the user query and joins terms with AND so all words must match
    somewhere in the indexed columns.  Falls back to LIKE if FTS yields nothing.
    """
    conn = _get_conn()
    results: list[dict] = []

    words = query.strip().split()
    if not words:
        conn.close()
        return results

    fts_query = " AND ".join(f'"{w}"*' for w in words)

    try:
        rows = conn.execute(
            """
            SELECT r.*
            FROM recipes_fts fts
            JOIN recipes r ON r.id = fts.rowid
            WHERE recipes_fts MATCH ?
            ORDER BY rank
            LIMIT ?
            """,
            (fts_query, limit),
        ).fetchall()
        results = [_row_to_dict(r) for r in rows]
    except sqlite3.OperationalError:
        pass

    # Fallback: LIKE search if FTS returned nothing
    if not results:
        like = f"%{query}%"
        rows = conn.execute(
            """
            SELECT * FROM recipes
            WHERE title LIKE ? OR category LIKE ?
               OR subcategory LIKE ? OR ingredients LIKE ?
            LIMIT ?
            """,
            (like, like, like, like, limit),
        ).fetchall()
        results = [_row_to_dict(r) for r in rows]

    conn.close()
    return results


def search_by_ids(ids: list[int]) -> list[dict]:
    """Get recipes by a list of IDs, preserving the order of *ids*."""
    if not ids:
        return []
    conn = _get_conn()
    placeholders = ",".join("?" for _ in ids)
    rows = conn.execute(
        f"SELECT * FROM recipes WHERE id IN ({placeholders})", ids
    ).fetchall()
    conn.close()

    by_id = {r["id"]: _row_to_dict(r) for r in rows}
    return [by_id[i] for i in ids if i in by_id]


def get_recipe(recipe_id: int) -> dict | None:
    """Get a single recipe by ID."""
    conn = _get_conn()
    row = conn.execute("SELECT * FROM recipes WHERE id = ?", (recipe_id,)).fetchone()
    conn.close()
    return _row_to_dict(row) if row else None


def get_all_summaries() -> list[tuple[int, str, str, str]]:
    """
    Return (id, title, category, subcategory) for every recipe.
    Used to build the candidate list for Gemini matching.
    """
    conn = _get_conn()
    rows = conn.execute(
        "SELECT id, title, category, subcategory FROM recipes ORDER BY id"
    ).fetchall()
    conn.close()
    return [(r["id"], r["title"], r["category"], r["subcategory"]) for r in rows]


def get_random_recipes(limit: int = 10) -> list[dict]:
    """Return *limit* random recipes for the home page."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT * FROM recipes ORDER BY RANDOM() LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [_row_to_dict(r) for r in rows]
