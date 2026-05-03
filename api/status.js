import { getRecipeCountFromMetadata } from '../lib/recipes.js';

export default async function handler(_req, res) {
  try {
    const recipeCount = await getRecipeCountFromMetadata();
    return res.status(200).json({
      recipeCount: recipeCount ?? 0,
      message: 'All app recipes are served from Firebase.'
    });
  } catch (err) {
    return res.status(500).json({ error: `Status check failed: ${err.message}` });
  }
}
