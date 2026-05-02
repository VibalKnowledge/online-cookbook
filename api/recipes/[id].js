import { getBaseRecipes } from '../../lib/cookbook.js';
import { getDb } from '../../lib/firebase.js';

async function getAddedById(id) {
  const db = getDb();
  if (!db) return null;
  const snap = await db.collection('addedRecipes').doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, sourceType: 'firebase', ...snap.data() };
}

async function getComments(id) {
  const db = getDb();
  if (!db) return [];
  const snap = await db.collection('recipeComments').where('recipeId', '==', id).orderBy('createdAt', 'desc').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'POST') {
    const db = getDb();
    if (!db) return res.status(400).json({ error: 'Firebase is not configured. Set FIREBASE_* env vars in Vercel.' });

    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Comment text is required.' });

    const payload = {
      recipeId: id,
      text,
      createdAt: new Date().toISOString()
    };

    await db.collection('recipeComments').add(payload);
    const comments = await getComments(id);
    return res.status(201).json({ message: 'Comment saved in Firebase for this cookbook.', comments });
  }

  const base = await getBaseRecipes();
  let recipe = base.find((r) => r.id === id);
  if (!recipe) recipe = await getAddedById(id);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found in connected cookbook sources.' });

  const comments = await getComments(id);
  res.status(200).json({ ...recipe, comments });
}
