(function () {
  'use strict';

  // ===== DOM Elements =====
  var nameInput = document.getElementById('name-input');
  var cravingInput = document.getElementById('craving-input');
  var cravingBtn = document.getElementById('craving-btn');
  var nameSearchWrap = document.getElementById('name-search');
  var cravingSearchWrap = document.getElementById('craving-search');
  var toggleBtns = document.querySelectorAll('.toggle-btn');
  var loadingEl = document.getElementById('loading');
  var resultsGrid = document.getElementById('results-grid');
  var resultsHeading = document.getElementById('results-heading');
  var emptyState = document.getElementById('empty-state');
  var modalOverlay = document.getElementById('modal-overlay');
  var modalClose = document.getElementById('modal-close');
  var modalLoading = document.getElementById('modal-loading');
  var modalContent = document.getElementById('modal-content');
  var modalTitle = document.getElementById('modal-title');
  var modalCategory = document.getElementById('modal-category');
  var modalSubcategory = document.getElementById('modal-subcategory');
  var modalServes = document.getElementById('modal-serves');
  var modalIngredients = document.getElementById('modal-ingredients');
  var modalInstructions = document.getElementById('modal-instructions');
  var modalNotes = document.getElementById('modal-notes');
  var modalNotesSection = document.getElementById('modal-notes-section');
  var apiKeyToggle = document.getElementById('api-key-toggle');
  var apiKeyForm = document.getElementById('api-key-form');
  var apiKeyInput = document.getElementById('api-key-input');
  var apiKeySave = document.getElementById('api-key-save');
  var apiKeyStatus = document.getElementById('api-key-status');

  var currentMode = 'name';
  var debounceTimer = null;
  var allRecipes = [];
  var recipesById = {};
  var fuse = null;

  // ===== API Key Management =====
  function getApiKey() {
    return localStorage.getItem('gemini_api_key') || '';
  }

  function setApiKey(key) {
    localStorage.setItem('gemini_api_key', key);
  }

  function updateApiKeyUI() {
    var key = getApiKey();
    if (key) {
      apiKeyToggle.textContent = '🔑 Gemini API Key ✓';
      apiKeyStatus.textContent = '✓ API key saved';
    } else {
      apiKeyToggle.textContent = '🔑 Set Gemini API Key';
      apiKeyStatus.textContent = '';
    }
  }

  apiKeyToggle.addEventListener('click', function (e) {
    e.preventDefault();
    apiKeyForm.classList.toggle('hidden');
    if (!apiKeyForm.classList.contains('hidden')) {
      apiKeyInput.value = getApiKey();
      apiKeyInput.focus();
    }
  });

  apiKeySave.addEventListener('click', function () {
    var key = apiKeyInput.value.trim();
    if (key) {
      setApiKey(key);
      apiKeyForm.classList.add('hidden');
      updateApiKeyUI();
    }
  });

  apiKeyInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      apiKeySave.click();
    }
  });

  updateApiKeyUI();

  // ===== Toggle Mode =====
  toggleBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var mode = btn.dataset.mode;
      if (mode === currentMode) return;
      currentMode = mode;

      toggleBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');

      if (mode === 'name') {
        nameSearchWrap.classList.remove('hidden');
        cravingSearchWrap.classList.add('hidden');
        nameInput.focus();
      } else {
        nameSearchWrap.classList.add('hidden');
        cravingSearchWrap.classList.remove('hidden');
        cravingInput.focus();
      }
    });
  });

  // ===== Loading Helpers =====
  function showLoading() {
    loadingEl.classList.remove('hidden');
    resultsGrid.innerHTML = '';
    emptyState.classList.add('hidden');
  }

  function hideLoading() {
    loadingEl.classList.add('hidden');
  }

  // ===== Render Cards =====
  function renderCards(recipes, heading) {
    hideLoading();
    resultsHeading.textContent = heading || 'Results';
    resultsGrid.innerHTML = '';

    if (!recipes || recipes.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');

    recipes.forEach(function (recipe) {
      var card = document.createElement('div');
      card.className = 'recipe-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.dataset.id = recipe.id;

      var title = document.createElement('div');
      title.className = 'recipe-card-title';
      title.textContent = recipe.title || recipe.name || 'Untitled';

      var meta = document.createElement('div');
      meta.className = 'recipe-card-meta';

      if (recipe.category) {
        var badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = recipe.category;
        meta.appendChild(badge);
      }

      if (recipe.subcategory) {
        var sub = document.createElement('span');
        sub.className = 'recipe-card-subcategory';
        sub.textContent = recipe.subcategory;
        meta.appendChild(sub);
      }

      if (recipe.serves) {
        var serves = document.createElement('span');
        serves.className = 'recipe-card-serves';
        serves.textContent = 'Serves ' + recipe.serves;
        meta.appendChild(serves);
      }

      card.appendChild(title);
      card.appendChild(meta);

      card.addEventListener('click', function () {
        openModal(recipe.id);
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openModal(recipe.id);
        }
      });

      resultsGrid.appendChild(card);
    });
  }

  // ===== Random Recipes =====
  function getRandomRecipes(count) {
    var shuffled = allRecipes.slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = temp;
    }
    return shuffled.slice(0, count);
  }

  function showRandomRecipes() {
    var random = getRandomRecipes(12);
    renderCards(random, 'Discover Recipes');
  }

  // ===== Name Search (Fuse.js) =====
  function searchByName(query) {
    if (!query.trim()) {
      showRandomRecipes();
      return;
    }
    if (!fuse) return;

    var results = fuse.search(query.trim(), { limit: 30 });
    // Filter out weak matches
    results = results.filter(function (r) { return r.score <= 0.3; });
    var recipes = results.map(function (r) { return r.item; });
    renderCards(recipes, 'Results for "' + query.trim() + '"');
  }

  // ===== Craving Search =====
  async function searchByCraving(query) {
    if (!query.trim()) return;
    showLoading();

    // Step 1: Get top 80 Fuse.js keyword matches
    var keywords = query.trim().split(/\s+/).join(' ');
    var fuseResults = fuse.search(keywords, { limit: 80 });
    var candidateRecipes = fuseResults.map(function (r) { return r.item; });

    if (candidateRecipes.length === 0) {
      renderCards([], 'Recipes for your craving');
      return;
    }

    var apiKey = getApiKey();

    // Step 2: If no API key, show Fuse.js results with a note
    if (!apiKey) {
      renderCards(candidateRecipes.slice(0, 24), 'Recipes for your craving');
      var note = document.createElement('p');
      note.className = 'craving-note';
      note.textContent = 'Tip: Set a Gemini API key for smarter craving-based results.';
      resultsGrid.parentNode.insertBefore(note, resultsGrid);
      // Remove note on next search
      setTimeout(function () {
        if (note.parentNode) note.parentNode.removeChild(note);
      }, 15000);
      return;
    }

    // Step 3: Send to Gemini for ranking
    try {
      var recipeSummaries = candidateRecipes.map(function (r) {
        return { id: r.id, title: r.title, category: r.category || '', subcategory: r.subcategory || '' };
      });

      var prompt = 'A user is craving: "' + query.trim() + '"\n\n' +
        'Here are candidate recipes (JSON array with id, title, category, subcategory):\n' +
        JSON.stringify(recipeSummaries) + '\n\n' +
        'Rank the recipes by how well they match the craving. Return ONLY a JSON array of recipe IDs (numbers) in order from best match to worst match. ' +
        'Include at most 24 recipes. Return ONLY the JSON array, no other text.';

      var response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (!response.ok) {
        throw new Error('Gemini API error: ' + response.status);
      }

      var data = await response.json();
      var text = data.candidates[0].content.parts[0].text;
      // Extract JSON array from response (may have markdown fences)
      var jsonMatch = text.match(/\[[\s\S]*?\]/);
      if (!jsonMatch) throw new Error('No JSON array in response');

      var rankedIds = JSON.parse(jsonMatch[0]);
      var rankedRecipes = [];
      rankedIds.forEach(function (id) {
        var recipe = recipesById[id];
        if (recipe) rankedRecipes.push(recipe);
      });

      if (rankedRecipes.length > 0) {
        renderCards(rankedRecipes, 'Recipes for your craving');
      } else {
        // Fallback to Fuse.js results
        renderCards(candidateRecipes.slice(0, 24), 'Recipes for your craving');
      }
    } catch (err) {
      console.error('Gemini API error:', err);
      // Fallback to Fuse.js results
      renderCards(candidateRecipes.slice(0, 24), 'Recipes for your craving');
    }
  }

  // ===== Debounced Name Search =====
  nameInput.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      searchByName(nameInput.value);
    }, 300);
  });

  // ===== Craving Search Events =====
  cravingBtn.addEventListener('click', function () {
    searchByCraving(cravingInput.value);
  });

  cravingInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      searchByCraving(cravingInput.value);
    }
  });

  // ===== Modal =====
  function openModal(id) {
    var recipe = recipesById[id];
    if (!recipe) return;

    modalOverlay.classList.remove('hidden');
    modalLoading.classList.add('hidden');
    modalContent.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    populateModal(recipe);
  }

  function populateModal(recipe) {
    modalTitle.textContent = recipe.title || recipe.name || 'Untitled';

    if (recipe.category) {
      modalCategory.textContent = recipe.category;
      modalCategory.classList.remove('hidden');
    } else {
      modalCategory.classList.add('hidden');
    }

    modalSubcategory.textContent = recipe.subcategory || '';
    modalServes.textContent = recipe.serves ? 'Serves ' + recipe.serves : '';

    // Ingredients
    modalIngredients.innerHTML = '';
    var ingredients = recipe.ingredients || [];
    if (typeof ingredients === 'string') {
      ingredients = ingredients.split('\n').filter(function (l) { return l.trim(); });
    }
    ingredients.forEach(function (item) {
      var li = document.createElement('li');
      var text = typeof item === 'string' ? item.trim() : String(item);
      // Strip leading dashes/bullets
      text = text.replace(/^[-•·]\s*/, '');
      li.textContent = text;
      modalIngredients.appendChild(li);
    });

    // Instructions
    modalInstructions.innerHTML = '';
    var instructions = recipe.instructions || '';
    if (Array.isArray(instructions)) {
      instructions = instructions.join('\n\n');
    }
    instructions.split(/\n\s*\n|\n/).filter(function (p) { return p.trim(); }).forEach(function (para) {
      var p = document.createElement('p');
      p.textContent = para.trim();
      modalInstructions.appendChild(p);
    });

    // Notes
    if (recipe.notes && recipe.notes.trim()) {
      modalNotes.textContent = recipe.notes;
      modalNotesSection.classList.remove('hidden');
    } else {
      modalNotesSection.classList.add('hidden');
    }
  }

  function closeModal() {
    modalOverlay.classList.add('hidden');
    document.body.style.overflow = '';
  }

  modalClose.addEventListener('click', closeModal);

  modalOverlay.addEventListener('click', function (e) {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modalOverlay.classList.contains('hidden')) {
      closeModal();
    }
  });

  // ===== Init: Load recipes and build Fuse index =====
  showLoading();
  fetch('/recipes.json')
    .then(function (res) {
      if (!res.ok) throw new Error('Failed to load recipes');
      return res.json();
    })
    .then(function (data) {
      allRecipes = data;

      // Build lookup map
      allRecipes.forEach(function (r) {
        recipesById[r.id] = r;
      });

      // Build Fuse.js search index
      fuse = new Fuse(allRecipes, {
        keys: [
          { name: 'title', weight: 5 },
          { name: 'subcategory', weight: 1 }
        ],
        threshold: 0.25,
        distance: 200,
        includeScore: true,
        minMatchCharLength: 2,
        ignoreLocation: true
      });

      // Show 12 random recipes
      showRandomRecipes();
    })
    .catch(function (err) {
      console.error('Failed to load recipes:', err);
      hideLoading();
      emptyState.classList.remove('hidden');
    });
})();
