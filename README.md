# Joanne's Online Cookbook

A recipe search app for ~4,400 family recipes from Joanne's Cookbook collection.

## Features

- **Search by name** — fuzzy text search across recipe titles, categories, and ingredients
- **"What do I feel like?"** — describe a craving (e.g., "something warm and cheesy") and get AI-powered recipe suggestions using Google Gemini

## Deploy to Vercel

1. Connect this repo to [Vercel](https://vercel.com)
2. It will auto-detect the config — no build step needed
3. That's it — the app is fully static

## Rebuilding the recipe data

If you update the .docx files in `Joanne_s Cookbook/`:

```bash
pip install -r requirements.txt
python3 app/parse_recipes.py          # parses .docx → recipes.db
python3 -c "
import sqlite3, json
conn = sqlite3.connect('recipes.db')
conn.row_factory = sqlite3.Row
rows = conn.execute('SELECT id, title, category, subcategory, ingredients, instructions, notes, serves FROM recipes').fetchall()
recipes = [dict(r) for r in rows]
for r in recipes:
    for k in r:
        if r[k] is None: r[k] = ''
conn.close()
with open('public/recipes.json', 'w') as f:
    json.dump(recipes, f, separators=(',', ':'))
"
```

Then commit and push — Vercel will redeploy automatically.

## AI Craving Search

The "What do I feel like?" mode uses Google Gemini 2.0 Flash. Users enter their own API key in the browser (stored in localStorage, never sent to any server). Get a free key at https://aistudio.google.com/apikey.

Works without a key too — falls back to keyword-based fuzzy search.

## Tech Stack

- Vanilla HTML/CSS/JS (no frameworks)
- Fuse.js for client-side fuzzy search
- Google Gemini 2.0 Flash (optional, free tier)
- Vercel for hosting (static site)
