import { getBaseRecipes } from '../lib/cookbook.js';
import { getDb } from '../lib/firebase.js';

async function deletePriorImportedDocs(db) {
  const snap = await db.collection('recipes').where('sourceType', '==', 'imported-docx').get();
  if (snap.empty) return 0;

  let deleted = 0;
  let batch = db.batch();
  let opCount = 0;

  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    opCount += 1;
    deleted += 1;

    if (opCount === 450) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) await batch.commit();
  return deleted;
}

async function main() {
  const db = getDb();
  if (!db) {
    throw new Error('Firebase is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.');
  }

  const deleted = await deletePriorImportedDocs(db);
  if (deleted) console.log(`Removed ${deleted} previous imported-docx records.`);

  const recipes = await getBaseRecipes();
  if (!recipes.length) {
    console.log('No recipes found in Joanne_s Cookbook.');
    return;
  }

  let count = 0;
  for (const recipe of recipes) {
    const payload = {
      name: recipe.name,
      category: recipe.category,
      sourceType: 'imported-docx',
      sourcePath: recipe.sourcePath,
      ingredients: recipe.ingredients || [],
      instructions: recipe.instructions || [],
      notes: recipe.notes || [],
      tags: recipe.tags || [],
      prepTime: recipe.prepTime || '',
      cookTime: recipe.cookTime || '',
      servings: recipe.servings || '',
      rawText: recipe.rawText || '',
      importedAt: new Date().toISOString()
    };

    await db.collection('recipes').doc(recipe.id).set(payload, { merge: true });
    count += 1;
  }

  console.log(`Imported ${count} recipes into Firestore collection: recipes`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
