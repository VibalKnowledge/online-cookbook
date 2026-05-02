import { getAllRecipes } from '../lib/recipes.js';

export default async function handler(_req, res) {
  try {
    const recipes = await getAllRecipes();
    return res.status(200).json({
      recipeCount: recipes.length,
      message: 'All app recipes are served from Firebase.'
    });
  } catch (err) {
    return res.status(500).json({ error: `Status check failed: ${err.message}` });
  }
}
