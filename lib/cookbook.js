import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import mammoth from 'mammoth';

const COOKBOOK_ROOT = path.resolve(process.cwd(), 'Joanne_s Cookbook');

function toId(input) {
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 16);
}

function cleanName(fileName) {
  return fileName.replace(/\.[^/.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function splitLinesKeepStructure(text) {
  return text.replace(/\r/g, '').split('\n');
}

function normalize(line) {
  return line.replace(/\s+/g, ' ').trim();
}

function isSectionLabel(line) {
  const l = line.toLowerCase();
  return l.includes('ingredient') || l.includes('instruction') || l.includes('direction') || l.includes('method') || l.includes('note') || l.includes('tip');
}

function isLikelyRecipeTitle(line) {
  const t = normalize(line);
  if (!t || t.length < 4 || t.length > 90) return false;
  if (isSectionLabel(t)) return false;
  if (/^\d+[\.)\-]/.test(t)) return false;

  const alpha = (t.match(/[A-Za-z]/g) || []).length;
  if (alpha < 4) return false;

  const allCaps = t === t.toUpperCase() && /[A-Z]/.test(t);
  const words = t.split(' ');
  const titleCaseLike = words.length >= 2 && words.filter((w) => /^[A-Z][a-z]/.test(w)).length >= Math.max(2, Math.ceil(words.length * 0.6));

  return allCaps || titleCaseLike;
}

function parseSections(lines) {
  const ingredients = [];
  const instructions = [];
  const notes = [];
  let mode = 'instructions';

  for (const raw of lines) {
    const line = normalize(raw);
    if (!line) continue;
    const low = line.toLowerCase();

    if (low.includes('ingredient')) {
      mode = 'ingredients';
      continue;
    }
    if (low.includes('instruction') || low.includes('direction') || low.includes('method')) {
      mode = 'instructions';
      continue;
    }
    if (low.includes('note') || low.includes('tip')) {
      mode = 'notes';
      continue;
    }

    if (mode === 'ingredients') ingredients.push(line);
    else if (mode === 'notes') notes.push(line);
    else instructions.push(line);
  }

  return { ingredients, instructions, notes };
}

function splitIntoRecipeBlocks(rawLines, fallbackName) {
  const blocks = [];
  let current = null;

  for (let i = 0; i < rawLines.length; i += 1) {
    const line = normalize(rawLines[i]);
    if (!line) continue;

    if (isLikelyRecipeTitle(line)) {
      if (current && current.lines.length) blocks.push(current);
      current = { name: line, lines: [] };
      continue;
    }

    if (!current) current = { name: fallbackName, lines: [] };
    current.lines.push(line);
  }

  if (current && current.lines.length) blocks.push(current);

  if (!blocks.length) {
    return [{ name: fallbackName, lines: rawLines.map(normalize).filter(Boolean) }];
  }

  return blocks;
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

async function parseDocxRecipes(filePath) {
  const relativePath = path.relative(COOKBOOK_ROOT, filePath);
  const parts = relativePath.split(path.sep);
  const category = parts.length > 1 ? parts[0].trim() : 'Uncategorized';
  const fallbackName = cleanName(path.basename(filePath));

  const extracted = await mammoth.extractRawText({ path: filePath });
  const lines = splitLinesKeepStructure(extracted.value || '');
  const blocks = splitIntoRecipeBlocks(lines, fallbackName);

  return blocks.map((block, idx) => {
    const parsed = parseSections(block.lines);
    const name = normalize(block.name) || `${fallbackName} ${idx + 1}`;

    return {
      id: toId(`docx:${relativePath}:${idx}:${name}`),
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
      rawText: [name, category, ...block.lines].join('\n')
    };
  });
}

async function readBaseRecipes() {
  const files = await listFilesRecursive(COOKBOOK_ROOT);
  const recipes = [];

  for (const file of files) {
    if (!file.toLowerCase().endsWith('.docx')) continue;
    try {
      recipes.push(...(await parseDocxRecipes(file)));
    } catch {
      // Skip unreadable documents and continue import.
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
