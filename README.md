# Joanne's Online Cookbook

A recipe search app for ~4,400 family recipes from Joanne's Cookbook collection.

## Features

- **Search by name** — fuzzy text search across recipe titles, categories, and ingredients
- **"What do I feel like?"** — describe a craving (e.g., "something warm and cheesy") and get AI-powered recipe suggestions using Google Gemini

## Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Parse the .docx recipe files into the database (first time only)
python3 app/parse_recipes.py

# (Optional) Set up Google Gemini for AI-powered craving search
cp .env.example .env
# Edit .env and add your free API key from https://aistudio.google.com/apikey

# Run the app
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Open http://localhost:8000 in your browser.

## How it works

1. **Parser** (`app/parse_recipes.py`) reads 254 .docx files and extracts individual recipes (title, ingredients, instructions, notes, serving size) into a SQLite database with full-text search indexing.

2. **Name search** uses SQLite FTS5 for fast fuzzy matching.

3. **Craving search** pre-filters candidates via FTS, then sends them to Google Gemini Flash to rank by relevance to your mood. Works without an API key (falls back to keyword search).

## Tech Stack

- Python / FastAPI
- SQLite with FTS5
- Google Gemini 2.0 Flash (free tier)
- Vanilla HTML/CSS/JS
