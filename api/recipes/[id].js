import { getDb } from '../../lib/firebase.js';

async function getComments(id) {
  const db = getDb();
  if (!db) return [];

  const snap = await db
    .collection('recipeComments')
    .where('recipeId', '==', id)
    .orderBy('createdAt', 'desc')
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export default async function handler(req, res) {
  const { id } = req.query;

  try {
    const db = getDb();
    if (!db) return res.status(400).json({ error: 'Firebase is not configured. Set FIREBASE_* env vars in Vercel.' });

    if (req.method === 'POST') {
      const text = String(req.body?.text || '').trim();
      if (!text) return res.status(400).json({ error: 'Comment text is required.' });

      await db.collection('recipeComments').add({
        recipeId: id,
        text,
        createdAt: new Date().toISOString()
      });

      const comments = await getComments(id);
      return res.status(201).json({ message: 'Comment saved.', comments });
    }

    const doc = await db.collection('recipes').doc(id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Recipe not found.' });

    const comments = await getComments(id);
    return res.status(200).json({ id: doc.id, ...doc.data(), comments });
  } catch (err) {
    return res.status(500).json({ error: `Recipe request failed: ${err.message}` });
  }
}
