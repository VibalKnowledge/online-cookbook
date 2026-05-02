import { getBaseRecipes, getCookbookRoot } from '../lib/cookbook.js';

export default async function handler(_req, res) {
  const recipes = await getBaseRecipes();
  res.status(200).json({
    root: getCookbookRoot(),
    recipeCount: recipes.length,
    message: 'All recipes and categories come only from the connected folder. New recipes/comments are stored in Firebase for Vercel runtime persistence.'
  });
}
