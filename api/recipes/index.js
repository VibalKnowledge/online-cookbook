import { getDb } from '../../lib/firebase.js';
import { filterRecipes, getAllRecipes, toSummaryList } from '../../lib/recipes.js';

export default async function handler(req, res) {
  try {
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
        sourceType: 'user-added',
        createdAt: new Date().toISOString()
      };

      const ref = await db.collection('recipes').add(payload);
      return res.status(201).json({ message: 'Recipe saved in Firebase.', recipe: { id: ref.id, ...payload } });
    }

    const search = String(req.query.search || '').trim();
    const category = String(req.query.category || '').trim();

    const recipes = await getAllRecipes();
    const filtered = filterRecipes(recipes, search, category);
    return res.status(200).json(toSummaryList(filtered));
  } catch (err) {
    return res.status(500).json({ error: `Failed to load recipes: ${err.message}` });
  }
}
