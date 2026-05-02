import { getBaseRecipes } from '../../lib/cookbook.js';
import { getDb } from '../../lib/firebase.js';

function recipeSummary(r) {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    sourceType: r.sourceType,
    prepTime: r.prepTime || '',
    cookTime: r.cookTime || '',
    servings: r.servings || '',
    tags: Array.isArray(r.tags) ? r.tags : []
  };
}

async function getAddedRecipes() {
  const db = getDb();
  if (!db) return [];
  const snap = await db.collection('addedRecipes').get();
  return snap.docs.map((d) => ({ id: d.id, sourceType: 'firebase', ...d.data() }));
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const db = getDb();
    if (!db) return res.status(400).json({ error: 'Firebase is not configured. Set FIREBASE_* env vars in Vercel.' });

    const { name, category, ingredients, instructions, notes, tags, prepTime, cookTime, servings } = req.body || {};
    if (!name || !category || !Array.isArray(ingredients) || !Array.isArray(instructions)) {
      return res.status(400).json({ error: 'name, category, ingredients, and instructions are required.' });
    }

    const payload = {
      name: String(name).trim(),
      category: String(category).trim(),
      ingredients: ingredients.map((x) => String(x).trim()).filter(Boolean),
      instructions: instructions.map((x) => String(x).trim()).filter(Boolean),
      notes: Array.isArray(notes) ? notes.map((x) => String(x).trim()).filter(Boolean) : [],
      tags: Array.isArray(tags) ? tags.map((x) => String(x).trim()).filter(Boolean) : [],
      prepTime: String(prepTime || '').trim(),
      cookTime: String(cookTime || '').trim(),
      servings: String(servings || '').trim(),
      createdAt: new Date().toISOString()
    };

    const ref = await db.collection('addedRecipes').add(payload);
    return res.status(201).json({ message: 'Recipe saved in Firebase for this cookbook.', recipe: { id: ref.id, sourceType: 'firebase', ...payload } });
  }

  const search = String(req.query.search || '').toLowerCase().trim();
  const category = String(req.query.category || '').trim();

  const base = await getBaseRecipes();
  const added = await getAddedRecipes();
  let results = [...base, ...added];

  if (category) results = results.filter((r) => r.category === category);
  if (search) {
    results = results.filter((r) => {
      const blob = [
        r.name,
        r.category,
        ...(r.ingredients || []),
        ...(r.instructions || []),
        ...(r.notes || []),
        ...(r.tags || []),
        r.rawText || ''
      ].join('\n').toLowerCase();
      return blob.includes(search);
    });
  }

  results.sort((a, b) => a.name.localeCompare(b.name));
  res.status(200).json(results.map(recipeSummary));
}
