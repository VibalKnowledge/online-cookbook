(function () {
  'use strict';

  // ===== DOM Elements =====
  const nameInput = document.getElementById('name-input');
  const cravingInput = document.getElementById('craving-input');
  const cravingBtn = document.getElementById('craving-btn');
  const nameSearchWrap = document.getElementById('name-search');
  const cravingSearchWrap = document.getElementById('craving-search');
  const toggleBtns = document.querySelectorAll('.toggle-btn');
  const loadingEl = document.getElementById('loading');
  const resultsGrid = document.getElementById('results-grid');
  const resultsHeading = document.getElementById('results-heading');
  const emptyState = document.getElementById('empty-state');
  const modalOverlay = document.getElementById('modal-overlay');
  const modalClose = document.getElementById('modal-close');
  const modalLoading = document.getElementById('modal-loading');
  const modalContent = document.getElementById('modal-content');
  const modalTitle = document.getElementById('modal-title');
  const modalCategory = document.getElementById('modal-category');
  const modalSubcategory = document.getElementById('modal-subcategory');
  const modalServes = document.getElementById('modal-serves');
  const modalIngredients = document.getElementById('modal-ingredients');
  const modalInstructions = document.getElementById('modal-instructions');
  const modalNotes = document.getElementById('modal-notes');
  const modalNotesSection = document.getElementById('modal-notes-section');

  let currentMode = 'name';
  let debounceTimer = null;

  // ===== Toggle Mode =====
  toggleBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const mode = btn.dataset.mode;
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

  // ===== API Calls =====
  function loadRandomRecipes() {
    showLoading();
    fetch('/api/random')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var recipes = data.recipes || data.results || data;
        renderCards(recipes, 'Discover Recipes');
      })
      .catch(function () {
        hideLoading();
        emptyState.classList.remove('hidden');
      });
  }

  function searchByName(query) {
    if (!query.trim()) {
      loadRandomRecipes();
      return;
    }
    showLoading();
    fetch('/api/search?q=' + encodeURIComponent(query.trim()) + '&mode=name')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var recipes = data.recipes || data.results || data;
        renderCards(recipes, 'Results for "' + query.trim() + '"');
      })
      .catch(function () {
        hideLoading();
        emptyState.classList.remove('hidden');
      });
  }

  function searchByCraving(query) {
    if (!query.trim()) return;
    showLoading();
    fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query.trim(), mode: 'craving' })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var recipes = data.recipes || data.results || data;
        renderCards(recipes, 'Recipes for your craving');
      })
      .catch(function () {
        hideLoading();
        emptyState.classList.remove('hidden');
      });
  }

  // ===== Debounced Name Search =====
  nameInput.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      searchByName(nameInput.value);
    }, 300);
  });

  // ===== Craving Search =====
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
    modalOverlay.classList.remove('hidden');
    modalContent.classList.add('hidden');
    modalLoading.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    fetch('/api/recipe/' + encodeURIComponent(id))
      .then(function (res) { return res.json(); })
      .then(function (recipe) {
        populateModal(recipe);
        modalLoading.classList.add('hidden');
        modalContent.classList.remove('hidden');
      })
      .catch(function () {
        modalLoading.classList.add('hidden');
        modalContent.classList.remove('hidden');
        modalTitle.textContent = 'Error loading recipe';
        modalIngredients.innerHTML = '';
        modalInstructions.innerHTML = '';
        modalNotes.textContent = '';
        modalCategory.textContent = '';
        modalSubcategory.textContent = '';
        modalServes.textContent = '';
        modalNotesSection.classList.add('hidden');
      });
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
      var text = typeof item === 'string' ? item.trim() : item;
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

  // ===== Init =====
  loadRandomRecipes();
})();
