import { getCategoriesFromMetadata } from '../lib/recipes.js';

export default async function handler(_req, res) {
  try {
    const categories = await getCategoriesFromMetadata();
    return res.status(200).json(categories);
  } catch (err) {
    return res.status(500).json({ error: `Failed to load categories: ${err.message}` });
  }
}
