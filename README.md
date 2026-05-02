# Connected Folder Cookbook (Vercel + Firebase)

This app now serves recipes directly from Firebase in production.

## Architecture
- Source folder: `Joanne_s Cookbook` (used for one-time import)
- Runtime API data: Firestore collection `recipes`
- User comments: Firestore collection `recipeComments`

## One-time import (required)
Run this locally once to load your existing cookbook into Firebase:

1. Set env vars locally:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (single line, with `\\n` escapes)

2. Run:
- `npm install`
- `npm run import:recipes`

This imports folder recipes into Firestore `recipes` using stable IDs.

## Vercel env vars
Set the same 3 env vars in Vercel Project Settings.

## Run locally
- `npm run dev`

## Deploy
- Push to GitHub and redeploy in Vercel.
