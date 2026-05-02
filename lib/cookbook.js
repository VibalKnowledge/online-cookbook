import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const COOKBOOK_ROOT = path.resolve(process.cwd(), 'Joanne_s Cookbook');

function toId(input) {
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 12);
}

function cleanName(fileName) {
  return fileName.replace(/\.[^/.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

async function listFilesRecursive(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await listFilesRecursive(full)));
    else files.push(full);
  }
  return files;
}

async function parseDocxRecipe(filePath) {
  const relativePath = path.relative(COOKBOOK_ROOT, filePath);
  const parts = relativePath.split(path.sep);
  const category = parts.length > 1 ? parts[0].trim() : 'Uncategorized';
  const name = cleanName(path.basename(filePath));

  // Runtime-safe Vercel strategy: index by folder + file name only.
  // This avoids parsing hundreds of .docx files during serverless cold starts.
  return {
    id: toId(`docx:${relativePath}`),
    sourceType: 'docx',
    sourcePath: relativePath,
    category,
    name,
    ingredients: [],
    instructions: [],
    notes: [],
    tags: [],
    prepTime: '',
    cookTime: '',
    servings: '',
    rawText: `${name}\n${category}`
  };
}

async function readBaseRecipes() {
  const files = await listFilesRecursive(COOKBOOK_ROOT);
  const recipes = [];

  for (const file of files) {
    if (!file.toLowerCase().endsWith('.docx')) continue;
    recipes.push(await parseDocxRecipe(file));
  }

  return recipes.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getBaseRecipes() {
  if (!globalThis.__baseRecipeCache) {
    globalThis.__baseRecipeCache = await readBaseRecipes();
  }
  return globalThis.__baseRecipeCache;
}

export function getCookbookRoot() {
  return COOKBOOK_ROOT;
}
