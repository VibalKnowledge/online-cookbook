import { getAllRecipes, getCategories } from '../lib/recipes.js';

export default async function handler(_req, res) {
  try {
    const recipes = await getAllRecipes();
    return res.status(200).json(getCategories(recipes));
  } catch (err) {
    return res.status(500).json({ error: `Failed to load categories: ${err.message}` });
  }
}
