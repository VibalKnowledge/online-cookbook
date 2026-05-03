import { getDb } from './firebase.js';

const DEFAULT_LIMIT = 120;

function recipeSummary(r) {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    sourceType: r.sourceType || 'firebase',
    prepTime: r.prepTime || '',
    cookTime: r.cookTime || '',
    servings: r.servings || '',
    tags: Array.isArray(r.tags) ? r.tags : []
  };
}

function normalizeText(v) {
  return String(v || '').toLowerCase().trim();
}

export async function getAllRecipes() {
  const db = getDb();
  if (!db) throw new Error('Firebase is not configured. Set FIREBASE_* env vars in Vercel.');

  const snap = await db.collection('recipes').get();
  return snap.docs.map((d) => ({ id: d.id, sourceType: 'firebase', ...d.data() }));
}

export async function queryRecipes({ search = '', category = '', limit = DEFAULT_LIMIT } = {}) {
  const db = getDb();
  if (!db) throw new Error('Firebase is not configured. Set FIREBASE_* env vars in Vercel.');

  const q = normalizeText(search);
  const c = String(category || '').trim();
  const cappedLimit = Math.max(1, Math.min(Number(limit) || DEFAULT_LIMIT, 200));

  let docs = [];

  if (q) {
    // Prefix search on normalized name; avoids scanning the full collection.
    const end = `${q}\uf8ff`;
    const snap = await db
      .collection('recipes')
      .where('nameLower', '>=', q)
      .where('nameLower', '<=', end)
      .orderBy('nameLower')
      .limit(c ? 300 : cappedLimit)
      .get();

    docs = snap.docs.map((d) => ({ id: d.id, sourceType: 'firebase', ...d.data() }));
    if (c) docs = docs.filter((r) => r.category === c).slice(0, cappedLimit);
  } else if (c) {
    const snap = await db.collection('recipes').where('category', '==', c).limit(cappedLimit).get();
    docs = snap.docs.map((d) => ({ id: d.id, sourceType: 'firebase', ...d.data() }));
    docs.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  } else {
    const snap = await db.collection('recipes').orderBy('nameLower').limit(cappedLimit).get();
    docs = snap.docs.map((d) => ({ id: d.id, sourceType: 'firebase', ...d.data() }));
  }

  return docs;
}

export async function getCategoriesFromMetadata() {
  const db = getDb();
  if (!db) throw new Error('Firebase is not configured. Set FIREBASE_* env vars in Vercel.');

  const doc = await db.collection('metadata').doc('catalog').get();
  if (!doc.exists) return [];
  const values = doc.data()?.categories;
  return Array.isArray(values) ? values : [];
}

export async function getRecipeCountFromMetadata() {
  const db = getDb();
  if (!db) throw new Error('Firebase is not configured. Set FIREBASE_* env vars in Vercel.');

  const doc = await db.collection('metadata').doc('catalog').get();
  if (!doc.exists) return null;
  const count = doc.data()?.recipeCount;
  return Number.isFinite(count) ? count : null;
}

export function toSummaryList(recipes) {
  return recipes.map(recipeSummary);
}
