const state = {
  recipes: [],
  categories: [],
  selectedCategory: '',
  search: ''
};

const els = {
  status: document.getElementById('status'),
  search: document.getElementById('search'),
  categories: document.getElementById('categories'),
  recipeCards: document.getElementById('recipeCards'),
  recipeDetail: document.getElementById('recipeDetail'),
  addRecipeSection: document.getElementById('addRecipeSection'),
  showAddForm: document.getElementById('showAddForm'),
  addRecipeForm: document.getElementById('addRecipeForm'),
  decideInput: document.getElementById('decideInput'),
  decideBtn: document.getElementById('decideBtn'),
  decideResults: document.getElementById('decideResults')
};

function setStatus(message) {
  els.status.textContent = message;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`API ${res.status}: ${raw.slice(0, 180)}`);
  }

  if (!res.ok) throw new Error(data.error || `API ${res.status}`);
  return data;
}

function renderCards(recipes) {
  if (!recipes.length) {
    els.recipeCards.innerHTML = '<p>No matching recipes in this connected folder.</p>';
    return;
  }

  els.recipeCards.innerHTML = recipes
    .map(
      (r) => `
    <article class="card">
      <h3>${escapeHtml(r.name)}</h3>
      <p>${escapeHtml(r.category)}</p>
      <p class="meta">Source: connected folder (${r.sourceType})</p>
      <button data-view="${r.id}">Open Recipe</button>
    </article>
  `
    )
    .join('');

  els.recipeCards.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      showRecipe(btn.getAttribute('data-view')).catch((err) => {
        setStatus(`Error opening recipe: ${err.message}`);
      });
    });
  });
}

function renderCategories() {
  const categoryButtons = ['']
    .concat(state.categories)
    .map((cat) => {
      const active = state.selectedCategory === cat ? 'active' : '';
      const label = cat || 'All categories';
      return `<button class="chip ${active}" data-category="${escapeHtml(cat)}">${escapeHtml(label)}</button>`;
    });
  els.categories.innerHTML = categoryButtons.join('');

  els.categories.querySelectorAll('[data-category]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedCategory = btn.getAttribute('data-category');
      loadRecipes().catch((err) => setStatus(`Error loading recipes: ${err.message}`));
    });
  });
}

async function loadRecipes() {
  const params = new URLSearchParams();
  if (state.search) params.set('search', state.search);
  if (state.selectedCategory) params.set('category', state.selectedCategory);
  state.recipes = await api(`/api/recipes?${params.toString()}`);
  renderCards(state.recipes);
  renderCategories();
}

function li(items) {
  return items.length ? `<ul>${items.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>` : '<p class="meta">Not listed</p>';
}

async function showRecipe(id) {
  const r = await api(`/api/recipes/${id}`);
  els.recipeDetail.classList.remove('hidden');

  els.recipeDetail.innerHTML = `
    <h2>${escapeHtml(r.name)}</h2>
    <p class="meta">Category: ${escapeHtml(r.category)} | Source path: ${escapeHtml(r.sourcePath || 'firebase')}</p>
    <p class="meta">All content for this recipe comes from your connected cookbook sources.</p>
    <h3>Ingredients</h3>
    ${li(r.ingredients || [])}
    <h3>Instructions</h3>
    ${li(r.instructions || [])}
    <h3>Notes</h3>
    ${li(r.notes || [])}
    <h3>Comments & Improvements</h3>
    <div id="commentsList">${renderComments(r.comments)}</div>
    <form id="commentForm">
      <textarea name="text" required placeholder="Add your changes, substitutions, or tips..."></textarea>
      <button type="submit">Save comment</button>
    </form>
  `;

  document.getElementById('commentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = e.target.text.value.trim();
    if (!text) return;
    try {
      const saved = await api(`/api/recipes/${r.id}`, {
        method: 'POST',
        body: JSON.stringify({ text })
      });
      document.getElementById('commentsList').innerHTML = renderComments(saved.comments);
      e.target.reset();
    } catch (err) {
      setStatus(`Error saving comment: ${err.message}`);
    }
  });

  els.recipeDetail.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderComments(comments) {
  if (!comments?.length) return '<p class="meta">No comments yet.</p>';
  return comments
    .map(
      (c) => `
    <div class="comment">
      <p>${escapeHtml(c.text)}</p>
      <p class="meta">Saved: ${new Date(c.createdAt).toLocaleString()}</p>
    </div>
  `
    )
    .join('');
}

function keywordScore(recipe, words) {
  const blob = [recipe.name, recipe.category, ...(recipe.tags || [])].join(' ').toLowerCase();
  return words.reduce((score, w) => score + (blob.includes(w) ? 2 : 0), 0);
}

function helpDecide() {
  const text = els.decideInput.value.toLowerCase().trim();
  if (!text) {
    els.decideResults.innerHTML = '<p>Add a preference to match recipes already in your folder.</p>';
    return;
  }
  const words = text.split(/\s+/).filter((w) => w.length > 2);

  const ranked = state.recipes
    .map((r) => ({ recipe: r, score: keywordScore(r, words) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((x) => x.recipe);

  if (!ranked.length) {
    els.decideResults.innerHTML = '<p>No matched recipes found in this folder.</p>';
    return;
  }

  els.decideResults.innerHTML = ranked
    .map(
      (r) => `
    <article class="card">
      <h3>${escapeHtml(r.name)}</h3>
      <p>${escapeHtml(r.category)}</p>
      <p class="meta">Matched from recipes in your connected folder.</p>
      <button data-view="${r.id}">Open Recipe</button>
    </article>
  `
    )
    .join('');

  els.decideResults.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      showRecipe(btn.getAttribute('data-view')).catch((err) => setStatus(`Error opening recipe: ${err.message}`));
    });
  });
}

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function boot() {
  const status = await api('/api/status');
  setStatus(`${status.recipeCount} recipes loaded from connected folder`);

  state.categories = await api('/api/categories');
  await loadRecipes();

  els.search.addEventListener('input', () => {
    state.search = els.search.value.trim();
    loadRecipes().catch((err) => setStatus(`Error loading recipes: ${err.message}`));
  });

  els.showAddForm.addEventListener('click', () => {
    els.addRecipeSection.classList.toggle('hidden');
  });

  els.decideBtn.addEventListener('click', helpDecide);

  els.addRecipeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);

    const payload = {
      name: form.get('name'),
      category: form.get('category'),
      prepTime: form.get('prepTime'),
      cookTime: form.get('cookTime'),
      servings: form.get('servings'),
      ingredients: String(form.get('ingredients'))
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
      instructions: String(form.get('instructions'))
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
      notes: String(form.get('notes'))
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
    };

    try {
      await api('/api/recipes', { method: 'POST', body: JSON.stringify(payload) });
      alert('Recipe saved.');
      e.target.reset();

      state.categories = await api('/api/categories');
      await loadRecipes();
    } catch (err) {
      setStatus(`Error saving recipe: ${err.message}`);
    }
  });
}

boot().catch((err) => {
  setStatus(`Error: ${err.message}`);
});
