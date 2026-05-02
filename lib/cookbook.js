import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import mammoth from 'mammoth';

const COOKBOOK_ROOT = path.resolve(process.cwd(), 'Joanne_s Cookbook');

function toId(input) {
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 12);
}

function cleanName(fileName) {
  return fileName.replace(/\.[^/.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function splitLines(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function parseSections(text) {
  const lines = splitLines(text);
  const ingredients = [];
  const instructions = [];
  const notes = [];
  let mode = 'instructions';

  for (const line of lines) {
    const low = line.toLowerCase();
    if (low.includes('ingredient')) { mode = 'ingredients'; continue; }
    if (low.includes('instruction') || low.includes('direction') || low.includes('method')) { mode = 'instructions'; continue; }
    if (low.includes('note') || low.includes('tip')) { mode = 'notes'; continue; }

    if (mode === 'ingredients') ingredients.push(line);
    else if (mode === 'notes') notes.push(line);
    else instructions.push(line);
  }

  return { ingredients, instructions, notes, rawText: lines.join('\n') };
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

  const result = await mammoth.extractRawText({ path: filePath });
  const parsed = parseSections(result.value || '');

  return {
    id: toId(`docx:${relativePath}`),
    sourceType: 'docx',
    sourcePath: relativePath,
    category,
    name,
    ingredients: parsed.ingredients,
    instructions: parsed.instructions,
    notes: parsed.notes,
    tags: [],
    prepTime: '',
    cookTime: '',
    servings: '',
    rawText: parsed.rawText
  };
}

async function readBaseRecipes() {
  const files = await listFilesRecursive(COOKBOOK_ROOT);
  const recipes = [];

  for (const file of files) {
    if (!file.toLowerCase().endsWith('.docx')) continue;
    try {
      recipes.push(await parseDocxRecipe(file));
    } catch {
      // Ignore unreadable file.
    }
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
