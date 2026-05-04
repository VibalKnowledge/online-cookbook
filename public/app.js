(function () {
  'use strict';

  // ===== Firebase Config =====
  var firebaseConfig = {
    apiKey: "AIzaSyAssNdy6WYV3MTscTeojOpepureKbgRfrg",
    authDomain: "family-cookbook-78dee.firebaseapp.com",
    projectId: "family-cookbook-78dee",
    storageBucket: "family-cookbook-78dee.firebasestorage.app",
    messagingSenderId: "268350824549",
    appId: "1:268350824549:web:0532055065abe036de268c"
  };

  var firebaseApp = null;
  var db = null;
  var auth = null;
  var currentUser = null;

  function initFirebase() {
    if (!firebaseConfig.apiKey) return false;
    try {
      firebaseApp = firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      auth = firebase.auth();
      return true;
    } catch (e) {
      console.error('Firebase init error:', e);
      return false;
    }
  }

  var firebaseReady = initFirebase();

  // ===== DOM Elements =====
  var authWall = document.getElementById('auth-wall');
  var authWallSignIn = document.getElementById('auth-wall-sign-in');
  var appMain = document.getElementById('app-main');
  var authBar = document.getElementById('auth-bar');

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
  var modalAddedBy = document.getElementById('modal-added-by');
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

  // Notes DOM
  var myNotesSection = document.getElementById('my-notes-section');
  var myNotesTextarea = document.getElementById('my-notes-textarea');
  var myNotesSave = document.getElementById('my-notes-save');
  var myNotesStatus = document.getElementById('my-notes-status');

  // Comments DOM
  var commentsList = document.getElementById('comments-list');
  var commentForm = document.getElementById('comment-form');
  var commentInput = document.getElementById('comment-input');
  var commentSignInPrompt = document.getElementById('comment-sign-in-prompt');

  // Add Recipe DOM
  var addRecipeOverlay = document.getElementById('add-recipe-overlay');
  var addRecipeCloseBtn = document.getElementById('add-recipe-close');
  var addRecipeForm = document.getElementById('add-recipe-form');
  var addRecipeStatus = document.getElementById('add-recipe-status');
  var addRecipeSubmit = document.getElementById('add-recipe-submit');

  var currentMode = 'name';
  var debounceTimer = null;
  var allRecipes = [];
  var recipesById = {};
  var fuse = null;
  var currentModalRecipeId = null;
  var notesSaveTimer = null;
  var userRecipes = []; // recipes from Firestore
  var recipesLoaded = false;
  var nextUserRecipeId = 100000; // IDs for user-added recipes start high

  // ===== Auth Wall =====
  function showAuthWall() {
    authWall.classList.remove('hidden');
    appMain.classList.add('hidden');
  }

  function hideAuthWall() {
    authWall.classList.add('hidden');
    appMain.classList.remove('hidden');
  }

  authWallSignIn.addEventListener('click', function () {
    var provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(function (err) {
      console.error('Sign-in error:', err);
    });
  });

  // ===== Auth Bar =====
  function renderAuthBar() {
    if (!firebaseReady || !currentUser) {
      authBar.classList.add('hidden');
      return;
    }
    authBar.classList.remove('hidden');
    var photoHTML = currentUser.photoURL
      ? '<img class="user-avatar" src="' + currentUser.photoURL + '" alt="">'
      : '';
    var displayName = currentUser.displayName || currentUser.email || 'User';
    authBar.innerHTML =
      '<div class="user-info">' +
        photoHTML +
        '<span class="user-name">' + displayName + '</span>' +
      '</div>' +
      '<button class="add-recipe-btn" id="add-recipe-btn">+ Add Recipe</button>' +
      '<button class="auth-btn" id="sign-out-btn">Sign Out</button>';

    document.getElementById('sign-out-btn').addEventListener('click', function () {
      auth.signOut();
    });
    document.getElementById('add-recipe-btn').addEventListener('click', function () {
      openAddRecipeModal();
    });
  }

  // ===== Auth State =====
  if (firebaseReady) {
    auth.onAuthStateChanged(function (user) {
      currentUser = user;
      renderAuthBar();
      if (user) {
        hideAuthWall();
        if (!recipesLoaded) {
          initApp();
        }
      } else {
        showAuthWall();
      }
      // Refresh modal if open
      if (currentModalRecipeId !== null && !modalOverlay.classList.contains('hidden')) {
        loadNotesAndComments(currentModalRecipeId);
      }
    });
  } else {
    // Firebase not ready — just load app without auth
    initApp();
  }

  // ===== Init App =====
  function initApp() {
    if (recipesLoaded) return;
    recipesLoaded = true;

    showLoading();
    fetch('/recipes.json')
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load recipes');
        return res.json();
      })
      .then(function (data) {
        allRecipes = data;
        allRecipes.forEach(function (r) {
          recipesById[r.id] = r;
        });

        // Load user-added recipes from Firestore
        if (firebaseReady) {
          loadUserRecipes().then(function () {
            buildSearchIndex();
            showRandomRecipes();
          });
        } else {
          buildSearchIndex();
          showRandomRecipes();
        }
      })
      .catch(function (err) {
        console.error('Failed to load recipes:', err);
        hideLoading();
        emptyState.classList.remove('hidden');
      });
  }

  function loadUserRecipes() {
    return db.collection('recipes').get()
      .then(function (snapshot) {
        snapshot.forEach(function (doc) {
          var data = doc.data();
          var recipe = {
            id: 'user_' + doc.id,
            title: data.title || '',
            category: data.category || '',
            subcategory: data.subcategory || '',
            ingredients: data.ingredients || '',
            instructions: data.instructions || '',
            notes: data.notes || '',
            serves: data.serves || '',
            addedBy: data.addedBy || 'Someone',
            addedByUid: data.addedByUid || '',
            firestoreId: doc.id
          };
          allRecipes.push(recipe);
          recipesById[recipe.id] = recipe;
        });
      })
      .catch(function (err) {
        console.error('Error loading user recipes:', err);
      });
  }

  function buildSearchIndex() {
    fuse = new Fuse(allRecipes, {
      keys: [
        { name: 'title', weight: 5 },
        { name: 'subcategory', weight: 1 }
      ],
      threshold: 0.35,
      distance: 200,
      includeScore: true,
      minMatchCharLength: 2,
      ignoreLocation: true,
      useExtendedSearch: true
    });
  }

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
      title.textContent = recipe.title || 'Untitled';

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

      if (recipe.addedBy) {
        var addedBadge = document.createElement('span');
        addedBadge.className = 'added-by-badge';
        addedBadge.textContent = 'Added by ' + recipe.addedBy;
        meta.appendChild(addedBadge);
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

    var words = query.trim().split(/\s+/).filter(function (w) { return w.length > 0; });
    var fuzzyWords = words.filter(function (w) { return w.length >= 2; });
    var prefixWords = words.filter(function (w) { return w.length < 2; });

    var searchExpr;
    if (fuzzyWords.length === 0) {
      searchExpr = query.trim();
    } else if (fuzzyWords.length === 1) {
      searchExpr = fuzzyWords[0];
    } else {
      searchExpr = { $and: fuzzyWords.map(function (w) { return { title: w }; }) };
    }

    var results = fuse.search(searchExpr, { limit: 80 });
    var recipes = results.map(function (r) { return r.item; });

    if (prefixWords.length > 0 && recipes.length > 0) {
      recipes = recipes.filter(function (r) {
        var titleWords = r.title.toLowerCase().replace(/['']/g, ' ').split(/\s+/);
        return prefixWords.every(function (pw) {
          var pl = pw.toLowerCase();
          return titleWords.some(function (tw) {
            return tw.indexOf(pl) === 0;
          });
        });
      });
    }

    recipes = recipes.slice(0, 30);
    renderCards(recipes, 'Results for "' + query.trim() + '"');
  }

  // ===== Craving Search =====
  async function searchByCraving(query) {
    if (!query.trim()) return;
    showLoading();

    var keywords = query.trim().split(/\s+/).join(' ');
    var fuseResults = fuse.search(keywords, { limit: 80 });
    var candidateRecipes = fuseResults.map(function (r) { return r.item; });

    if (candidateRecipes.length === 0) {
      renderCards([], 'Recipes for your craving');
      return;
    }

    var apiKey = getApiKey();

    if (!apiKey) {
      renderCards(candidateRecipes.slice(0, 24), 'Recipes for your craving');
      return;
    }

    try {
      var recipeSummaries = candidateRecipes.map(function (r) {
        return { id: r.id, title: r.title, category: r.category || '', subcategory: r.subcategory || '' };
      });

      var prompt = 'A user is craving: "' + query.trim() + '"\n\n' +
        'Here are candidate recipes (JSON array with id, title, category, subcategory):\n' +
        JSON.stringify(recipeSummaries) + '\n\n' +
        'Rank the recipes by how well they match the craving. Return ONLY a JSON array of recipe IDs in order from best match to worst match. ' +
        'Include at most 24 recipes. Return ONLY the JSON array, no other text.';

      var response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (!response.ok) throw new Error('Gemini API error: ' + response.status);

      var data = await response.json();
      var text = data.candidates[0].content.parts[0].text;
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
        renderCards(candidateRecipes.slice(0, 24), 'Recipes for your craving');
      }
    } catch (err) {
      console.error('Gemini API error:', err);
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

  // ===== Recipe Detail Modal =====
  function openModal(id) {
    var recipe = recipesById[id];
    if (!recipe) return;

    currentModalRecipeId = id;
    modalOverlay.classList.remove('hidden');
    modalLoading.classList.add('hidden');
    modalContent.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    populateModal(recipe);
    loadNotesAndComments(id);
  }

  function populateModal(recipe) {
    modalTitle.textContent = recipe.title || 'Untitled';

    // Added by
    if (recipe.addedBy) {
      modalAddedBy.textContent = 'Added by ' + recipe.addedBy;
      modalAddedBy.classList.remove('hidden');
    } else {
      modalAddedBy.classList.add('hidden');
    }

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

    // Notes (from recipe data)
    if (recipe.notes && recipe.notes.trim()) {
      modalNotes.textContent = recipe.notes;
      modalNotesSection.classList.remove('hidden');
    } else {
      modalNotesSection.classList.add('hidden');
    }
  }

  // ===== Private Notes (Firestore) =====
  function loadNotesAndComments(recipeId) {
    myNotesTextarea.value = '';
    myNotesStatus.textContent = '';
    commentsList.innerHTML = '';

    if (!firebaseReady || !currentUser) {
      myNotesSection.classList.add('hidden');
      commentForm.classList.add('hidden');
      commentSignInPrompt.classList.remove('hidden');
      loadComments(recipeId);
      return;
    }

    myNotesSection.classList.remove('hidden');
    commentForm.classList.remove('hidden');
    commentSignInPrompt.classList.add('hidden');

    // Load user's private note
    db.collection('notes')
      .doc(currentUser.uid + '_' + recipeId)
      .get()
      .then(function (doc) {
        if (doc.exists && currentModalRecipeId === recipeId) {
          myNotesTextarea.value = doc.data().text || '';
        }
      })
      .catch(function (err) {
        console.error('Error loading note:', err);
      });

    loadComments(recipeId);
  }

  // Save private note
  myNotesSave.addEventListener('click', function () {
    if (!currentUser || !currentModalRecipeId || !firebaseReady) return;

    var text = myNotesTextarea.value.trim();
    var docId = currentUser.uid + '_' + currentModalRecipeId;

    myNotesStatus.textContent = 'Saving...';

    if (!text) {
      db.collection('notes').doc(docId).delete()
        .then(function () {
          myNotesStatus.textContent = '✓ Cleared';
          setTimeout(function () { myNotesStatus.textContent = ''; }, 2000);
        })
        .catch(function (err) {
          console.error('Error deleting note:', err);
          myNotesStatus.textContent = 'Error saving';
        });
    } else {
      db.collection('notes').doc(docId).set({
        userId: currentUser.uid,
        recipeId: currentModalRecipeId,
        text: text,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      })
      .then(function () {
        myNotesStatus.textContent = '✓ Saved';
        setTimeout(function () { myNotesStatus.textContent = ''; }, 2000);
      })
      .catch(function (err) {
        console.error('Error saving note:', err);
        myNotesStatus.textContent = 'Error saving';
      });
    }
  });

  myNotesTextarea.addEventListener('input', function () {
    clearTimeout(notesSaveTimer);
    myNotesStatus.textContent = '';
    notesSaveTimer = setTimeout(function () {
      myNotesSave.click();
    }, 1500);
  });

  // ===== Public Comments (Firestore) =====
  function loadComments(recipeId) {
    if (!firebaseReady) return;

    commentsList.innerHTML = '<p class="comments-empty">Loading comments...</p>';

    db.collection('comments')
      .where('recipeId', '==', recipeId)
      .get()
      .then(function (snapshot) {
        if (currentModalRecipeId !== recipeId) return;

        commentsList.innerHTML = '';
        if (snapshot.empty) {
          commentsList.innerHTML = '<p class="comments-empty">No comments yet. Be the first to share a tip!</p>';
          return;
        }

        var docs = [];
        snapshot.forEach(function (doc) { docs.push({ id: doc.id, data: doc.data() }); });
        docs.sort(function (a, b) {
          var ta = a.data.createdAt ? (a.data.createdAt.toMillis ? a.data.createdAt.toMillis() : 0) : 0;
          var tb = b.data.createdAt ? (b.data.createdAt.toMillis ? b.data.createdAt.toMillis() : 0) : 0;
          return ta - tb;
        });
        docs.forEach(function (d) {
          renderComment(d.id, d.data);
        });
      })
      .catch(function (err) {
        console.error('Error loading comments:', err);
        commentsList.innerHTML = '<p class="comments-empty">Could not load comments. ' + (err.code || err.message || '') + '</p>';
      });
  }

  function renderComment(docId, data) {
    var card = document.createElement('div');
    card.className = 'comment-card';

    var avatar = document.createElement('div');
    avatar.className = 'comment-avatar';
    if (data.userPhoto) {
      avatar.innerHTML = '<img src="' + data.userPhoto + '" alt="">';
    } else {
      avatar.textContent = (data.userName || '?').charAt(0).toUpperCase();
    }

    var body = document.createElement('div');
    body.className = 'comment-body';

    var header = document.createElement('div');
    header.className = 'comment-header';

    var authorSpan = document.createElement('span');
    authorSpan.className = 'comment-author';
    authorSpan.textContent = data.userName || 'Anonymous';

    var dateSpan = document.createElement('span');
    dateSpan.className = 'comment-date';
    if (data.createdAt) {
      var d = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
      dateSpan.textContent = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    header.appendChild(authorSpan);
    header.appendChild(dateSpan);

    var textP = document.createElement('p');
    textP.className = 'comment-text';
    textP.textContent = data.text;

    body.appendChild(header);
    body.appendChild(textP);

    card.appendChild(avatar);
    card.appendChild(body);

    if (currentUser && data.userId === currentUser.uid) {
      var delBtn = document.createElement('button');
      delBtn.className = 'comment-delete';
      delBtn.textContent = '✕';
      delBtn.title = 'Delete comment';
      delBtn.addEventListener('click', function () {
        if (confirm('Delete this comment?')) {
          db.collection('comments').doc(docId).delete()
            .then(function () {
              card.remove();
              if (commentsList.children.length === 0) {
                commentsList.innerHTML = '<p class="comments-empty">No comments yet. Be the first to share a tip!</p>';
              }
            })
            .catch(function (err) {
              console.error('Error deleting comment:', err);
            });
        }
      });
      card.appendChild(delBtn);
    }

    commentsList.appendChild(card);
  }

  // Post comment
  commentForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!currentUser || !currentModalRecipeId || !firebaseReady) return;

    var text = commentInput.value.trim();
    if (!text) return;

    commentInput.value = '';
    commentInput.disabled = true;

    db.collection('comments').add({
      recipeId: currentModalRecipeId,
      userId: currentUser.uid,
      userName: currentUser.displayName || 'Anonymous',
      userPhoto: currentUser.photoURL || '',
      text: text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(function (docRef) {
      commentInput.disabled = false;
      commentInput.focus();
      var emptyMsg = commentsList.querySelector('.comments-empty');
      if (emptyMsg) emptyMsg.remove();
      renderComment(docRef.id, {
        userId: currentUser.uid,
        userName: currentUser.displayName || 'Anonymous',
        userPhoto: currentUser.photoURL || '',
        text: text,
        createdAt: new Date()
      });
    })
    .catch(function (err) {
      console.error('Error posting comment:', err);
      commentInput.disabled = false;
      commentInput.value = text;
    });
  });

  // ===== Add Recipe Modal =====
  function openAddRecipeModal() {
    addRecipeOverlay.classList.remove('hidden');
    addRecipeForm.reset();
    addRecipeStatus.textContent = '';
    addRecipeStatus.className = 'add-recipe-status';
    document.body.style.overflow = 'hidden';
    document.getElementById('add-title').focus();
  }

  function closeAddRecipeModal() {
    addRecipeOverlay.classList.add('hidden');
    document.body.style.overflow = '';
  }

  addRecipeCloseBtn.addEventListener('click', closeAddRecipeModal);

  addRecipeOverlay.addEventListener('click', function (e) {
    if (e.target === addRecipeOverlay) closeAddRecipeModal();
  });

  addRecipeForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!currentUser || !firebaseReady) return;

    var title = document.getElementById('add-title').value.trim();
    if (!title) return;

    addRecipeSubmit.disabled = true;
    addRecipeStatus.textContent = 'Adding recipe...';
    addRecipeStatus.className = 'add-recipe-status';

    var recipeData = {
      title: title,
      category: document.getElementById('add-category').value.trim(),
      subcategory: document.getElementById('add-subcategory').value.trim(),
      serves: document.getElementById('add-serves').value.trim(),
      ingredients: document.getElementById('add-ingredients').value.trim(),
      instructions: document.getElementById('add-instructions').value.trim(),
      notes: document.getElementById('add-notes').value.trim(),
      addedBy: currentUser.displayName || currentUser.email || 'Anonymous',
      addedByUid: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection('recipes').add(recipeData)
      .then(function (docRef) {
        // Add to local data
        var localRecipe = {
          id: 'user_' + docRef.id,
          title: recipeData.title,
          category: recipeData.category,
          subcategory: recipeData.subcategory,
          serves: recipeData.serves,
          ingredients: recipeData.ingredients,
          instructions: recipeData.instructions,
          notes: recipeData.notes,
          addedBy: recipeData.addedBy,
          addedByUid: recipeData.addedByUid,
          firestoreId: docRef.id
        };
        allRecipes.push(localRecipe);
        recipesById[localRecipe.id] = localRecipe;
        buildSearchIndex(); // rebuild Fuse index

        addRecipeStatus.textContent = '✓ Recipe added!';
        addRecipeStatus.className = 'add-recipe-status success';
        addRecipeSubmit.disabled = false;

        setTimeout(function () {
          closeAddRecipeModal();
          // Show the new recipe
          openModal(localRecipe.id);
        }, 1000);
      })
      .catch(function (err) {
        console.error('Error adding recipe:', err);
        addRecipeStatus.textContent = 'Error adding recipe: ' + (err.message || '');
        addRecipeStatus.className = 'add-recipe-status error';
        addRecipeSubmit.disabled = false;
      });
  });

  // ===== Modal Close =====
  function closeModal() {
    modalOverlay.classList.add('hidden');
    document.body.style.overflow = '';
    currentModalRecipeId = null;
    clearTimeout(notesSaveTimer);
  }

  modalClose.addEventListener('click', closeModal);

  modalOverlay.addEventListener('click', function (e) {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (!addRecipeOverlay.classList.contains('hidden')) {
        closeAddRecipeModal();
      } else if (!modalOverlay.classList.contains('hidden')) {
        closeModal();
      }
    }
  });
})();
