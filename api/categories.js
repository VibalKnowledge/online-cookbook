import { getBaseRecipes } from '../lib/cookbook.js';
import { getDb } from '../lib/firebase.js';

async function getAddedRecipes() {
  const db = getDb();
  if (!db) return [];
  const snap = await db.collection('addedRecipes').get();
  return snap.docs.map((d) => ({ id: d.id, sourceType: 'firebase', ...d.data() }));
}

export default async function handler(_req, res) {
  const base = await getBaseRecipes();
  const added = await getAddedRecipes();
  const cats = [...new Set([...base, ...added].map((r) => r.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  res.status(200).json(cats);
}
