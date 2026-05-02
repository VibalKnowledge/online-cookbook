# Connected Folder Cookbook (Vercel + Firebase)

This app is deployed as a Vercel static frontend + serverless API.

## Source-of-truth rules
- Base recipes and categories are loaded only from `Joanne_s Cookbook` in this project.
- Search and filtering only use those cookbook recipes plus user-added recipes saved for this same app.
- No outside recipe APIs are used.

## Why Firebase is used
Vercel serverless functions cannot reliably write back to project folder files at runtime. So:
- Base cookbook content stays in `Joanne_s Cookbook` (read-only in runtime)
- New recipes and recipe comments are stored in Firebase Firestore

## Data model
- `addedRecipes` collection
  - user-added recipes for this cookbook app
- `recipeComments` collection
  - comments keyed by `recipeId`

## API routes
- `GET /api/status`
- `GET /api/categories`
- `GET /api/recipes?search=&category=`
- `POST /api/recipes`
- `GET /api/recipes/:id`
- `POST /api/recipes/:id` (adds comment)

## Environment variables (Vercel Project Settings)
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Important: store private key with escaped newlines (`\\n`) exactly as Vercel provides it.

## Local dev
1. Install deps:
   - `npm install`
2. Run Vercel dev server:
   - `npm run dev`
3. Open:
   - `http://localhost:3000`

## Deploy
1. Push this project to a Git repo connected to Vercel.
2. Set the Firebase env vars in Vercel.
3. Deploy.

## Note on your original "save back to folder" requirement
On Vercel runtime, direct folder writes are not durable. This implementation keeps the fixed cookbook in-folder and persists user additions/comments in Firebase.
