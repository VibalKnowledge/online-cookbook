import { getDb } from './firebase.js';

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

function toSearchBlob(r) {
  return [
    r.name,
    r.category,
    ...(r.ingredients || []),
    ...(r.instructions || []),
    ...(r.notes || []),
    ...(r.tags || [])
  ]
    .join('\n')
    .toLowerCase();
}

export async function getAllRecipes() {
  const db = getDb();
  if (!db) throw new Error('Firebase is not configured. Set FIREBASE_* env vars in Vercel.');

  const snap = await db.collection('recipes').get();
  return snap.docs.map((d) => ({ id: d.id, sourceType: 'firebase', ...d.data() }));
}

export function filterRecipes(recipes, search, category) {
  let results = recipes;
  if (category) results = results.filter((r) => r.category === category);
  if (search) {
    const q = search.toLowerCase().trim();
    results = results.filter((r) => toSearchBlob(r).includes(q));
  }
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

export function getCategories(recipes) {
  return [...new Set(recipes.map((r) => r.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function toSummaryList(recipes) {
  return recipes.map(recipeSummary);
}
