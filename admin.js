/* ============================================================
   admin.js — Pannello amministrativo Valeria Moretti
   Protegge la dashboard (login Google + whitelist admin) e gestisce:
   1. Recensioni       → Firestore collection 'reviews' (Home automatica)
   2. Test gratuito    → Firestore collection 'quiz_questions' (test.html)
   3. Servizi/pacchetti→ Firestore collections 'service_packages',
                         'service_form_questions', 'service_requests'
   Richiede firebase-config.js caricato prima (window.firebase*).
   ============================================================ */
(function () {
  'use strict';

  // Firebase potrebbe impiegare qualche ms a esporre le funzioni globali:
  // questo script è un modulo, firebase-config.js è un modulo anch'esso e
  // viene eseguito prima (dichiarato prima nell'HTML), quindi qui sono già pronte.
  const FB = {
    auth: window.firebaseAuth,
    db: window.firebaseDB,
    provider: window.firebaseGoogleProvider,
    signInWithPopup: window.firebaseSignInWithPopup,
    signOut: window.firebaseSignOut,
    onAuthStateChanged: window.firebaseOnAuthStateChanged,
    doc: window.firebaseDoc,
    getDoc: window.firebaseGetDoc,
    setDoc: window.firebaseSetDoc,
    deleteDoc: window.firebaseDeleteDoc,
    collection: window.firebaseCollection,
    addDoc: window.firebaseAddDoc,
    getDocs: window.firebaseGetDocs,
    onSnapshot: window.firebaseOnSnapshot,
    ADMIN_EMAILS: window.firebaseADMIN_EMAILS || []
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  let busyCount = 0;
  function setBusy(on) {
    busyCount = Math.max(0, busyCount + (on ? 1 : -1));
    const bar = $('#loading-bar');
    if (bar) bar.classList.toggle('busy', busyCount > 0);
  }

  let toastTimer = null;
  function toast(msg, isErr) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('err', !!isErr);
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3400);
  }

  // Messaggio chiaro quando Firestore blocca il salvataggio per le Regole:
  // l'errore grezzo "Missing or insufficient permissions" non dice all'utente
  // cosa fare. Qui lo traduciamo in una istruzione pratica.
  function permHint(err, what) {
    const m = String((err && (err.message || err.code)) || '');
    if (/permission|insufficient|denied/i.test(m)) {
      return '⛔ Salvataggio ' + what + ' bloccato dalle REGOLE di Firebase: apri Console Firebase → Firestore Database → Regole e incolla il contenuto del file firestore-rules.txt del repository, poi premi "Pubblica". (Dettagli: ' + m + ')';
    }
    return 'Errore salvataggio ' + what + ': ' + m;
  }

  function confirmAction(title, text) {
    return new Promise((resolve) => {
      const overlay = $('#confirm-overlay');
      $('#confirm-title').textContent = title;
      $('#confirm-text').textContent = text;
      overlay.hidden = false;
      const yes = $('#confirm-yes'), no = $('#confirm-no');
      const cleanup = (val) => { overlay.hidden = true; yes.removeEventListener('click', onYes); no.removeEventListener('click', onNo); resolve(val); };
      const onYes = () => cleanup(true);
      const onNo = () => cleanup(false);
      yes.addEventListener('click', onYes);
      no.addEventListener('click', onNo);
    });
  }

  async function waitFirebase(maxMs = 5000) {
    const start = Date.now();
    while (!FB.db && Date.now() - start < maxMs) {
      await new Promise(r => setTimeout(r, 100));
      FB.auth = FB.auth || window.firebaseAuth;
      FB.db = window.firebaseDB;
      FB.collection = window.firebaseCollection;
      FB.getDocs = window.firebaseGetDocs;
      FB.setDoc = window.firebaseSetDoc;
      FB.deleteDoc = window.firebaseDeleteDoc;
      FB.addDoc = window.firebaseAddDoc;
      FB.doc = window.firebaseDoc;
      FB.getDoc = window.firebaseGetDoc;
      FB.signInWithPopup = window.firebaseSignInWithPopup;
      FB.signOut = window.firebaseSignOut;
      FB.onAuthStateChanged = window.firebaseOnAuthStateChanged;
      FB.provider = window.firebaseGoogleProvider;
      FB.onSnapshot = window.firebaseOnSnapshot;
    }
    return !!(FB.db && FB.auth && FB.onAuthStateChanged);
  }

  /* =========================== AUTH =========================== */
  function isAdmin(user) {
    if (!user || !user.email) return false;
    return FB.ADMIN_EMAILS.map(e => String(e).toLowerCase()).includes(user.email.toLowerCase());
  }

  function showDashboard(user) {
    $('#login-view').hidden = true;
    $('#app-view').classList.add('active');
    $('#user-email').textContent = user.email;
    initDashboard();
  }

  function showLogin(msg) {
    $('#login-view').hidden = false;
    $('#app-view').classList.remove('active');
    const m = $('#login-msg');
    m.className = 'login-msg' + (msg ? ' err' : '');
    m.textContent = msg || '';
  }

  async function doLogin() {
    const ok = await waitFirebase();
    if (!ok) { showLogin('Impossibile connettersi a Firebase. Ricarica la pagina.'); return; }
    $('#btn-login-google').disabled = true;
    try {
      const res = await FB.signInWithPopup(FB.auth, FB.provider);
      if (!isAdmin(res.user)) {
        await FB.signOut(FB.auth);
        showLogin('Accesso negato: l\'account non è autorizzato alla dashboard.');
      }
      // se autorizzato, l'onAuthStateChanged sotto mostra la dashboard
    } catch (err) {
      console.error(err);
      showLogin('Errore di accesso: ' + (err.message || err.code || 'riprova'));
    } finally {
      $('#btn-login-google').disabled = false;
    }
  }

  /* ==================== FIRESTORE CRUD HELPER ==================== */
  async function fsGetAll(colName) {
    const snap = await FB.getDocs(FB.collection(FB.db, colName));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  async function fsSet(colName, id, data) {
    await FB.setDoc(FB.doc(FB.db, colName, id), data, { merge: true });
  }
  async function fsDelete(colName, id) {
    await FB.deleteDoc(FB.doc(FB.db, colName, id));
  }
  async function fsAdd(colName, data) {
    const ref = await FB.addDoc(FB.collection(FB.db, colName), data);
    return ref.id;
  }

  /* ==================== RETE DI SALVATAGGIO DATI ====================
     Se il database del NUOVO progetto (mental-coach-2026) è vuoto o non
     ancora accessibile, la dashboard parte dai contenuti di default del
     sito: l'amministratrice trova subito recensioni, domande del test e
     pacchetti da modificare, senza "Errore caricamento ... not found". */
  async function ensureDefaultData() {
    // Nota: nessuna recensione finta viene importata — le recensioni devono
    // provenire solo da testimonianze reali pubblicate dalla dashboard.
    try {
      // --- Domande del test ---
      // Seed disattivato: le domande del test gratuito si creano SOLO dalla dashboard.
      // In più, pulizia automatica: se il database contiene ancora le domande
      // preimpostate di vecchia generazione (id 'q-01'… con la domanda
      // «Dove si bloccano i tuoi obiettivi?»), vengono rimosse una volta sola.
      let qs = [];
      try { qs = await fsGetAll('quiz_questions'); } catch (e) { qs = []; }
      try {
        const legacy = qs.filter(q => /^q-\d\d$/.test(q.id || '') && /Dove si bloccano/i.test(q.text || ''));
        if (legacy.length && !localStorage.getItem('vm_quiz_legacy_cleaned')) {
          for (const q of legacy) { await fsDelete('quiz_questions', q.id); }
          localStorage.setItem('vm_quiz_legacy_cleaned', '1');
          toast('Domande preimpostate rimosse dal database.');
        }
      } catch (e) { console.warn('pulizia domande legacy:', e); }
    } catch (e) { console.warn('ensureDefaultData quiz:', e); }
    try {
      // --- Pacchetti servizi ---
      let pkgs = [];
      try { pkgs = await fsGetAll('service_packages'); } catch (e) { pkgs = []; }
      if (!pkgs.length && Array.isArray(window.__defaultServicePackages) && window.__defaultServicePackages.length) {
        for (let i = 0; i < window.__defaultServicePackages.length; i++) {
          const p = window.__defaultServicePackages[i];
          await fsSet('service_packages', 'pkg-' + String(i + 1).padStart(2, '0'), {
            key: p.key, name: p.title, type: p.type, desc: p.desc,
            price: p.price || '', features: p.features || [],
            order: i + 1, active: true, showInHome: true, questionKeys: []
          });
        }
        toast('Pacchetti attuali importati nel nuovo database.');
      }
    } catch (e) { console.warn('ensureDefaultData packages:', e); }
  }

  /* ======================= RECENSIONI ========================= */
  const REV_COL = 'reviews';
  let allReviews = [];

  function fmtDateIT(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
      return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { return iso; }
  }

  function reviewDisplayName(r) {
    const ini = (r.initial || '').toUpperCase();
    return r.name + (ini ? ' ' + ini + '.' : '');
  }

  function renderReviewsTable() {
    const q = ($('#rev-search').value || '').trim().toLowerCase();
    const sorted = [...allReviews].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const filtered = sorted.filter(r => {
      if (!q) return true;
      return String(r.name || '').toLowerCase().includes(q) ||
             String(r.initial || '').toLowerCase().includes(q);
    });
    const tbody = $('#reviews-tbody');
    tbody.innerHTML = filtered.map(r => `
      <tr>
        <td><strong>${esc(r.name)}</strong></td>
        <td>${esc((r.initial || '').toUpperCase())}.</td>
        <td class="stars-view">${'★'.repeat(Number(r.stars) || 0)}${'☆'.repeat(5 - (Number(r.stars) || 0))}</td>
        <td>${esc(fmtDateIT(r.date))}</td>
        <td style="max-width:380px;">${esc(r.description && r.description.length > 110 ? r.description.slice(0, 110) + '…' : r.description)}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn--soft btn--sm" data-rev-edit="${esc(r.id)}"><i class="fa-solid fa-pen"></i> Modifica</button>
          <button class="btn btn--danger btn--sm" data-rev-del="${esc(r.id)}"><i class="fa-solid fa-trash-can"></i></button>
        </td>
      </tr>`).join('');
    $('#reviews-empty').hidden = filtered.length > 0;
  }

  async function loadReviews() {
    setBusy(true);
    try {
      allReviews = await fsGetAll(REV_COL).catch(e => {
        // Collezione 'reviews' non ancora creata nel nuovo progetto:
        // lista vuota (non è un errore), la popolerà ensureDefaultData.
        console.warn('loadReviews:', e); return [];
      });
      renderReviewsTableAndPreview();
    } catch (e) {
      console.error(e); toast('Errore caricamento recensioni: ' + e.message, true);
    } finally { setBusy(false); }
  }

  /* ---------- Rating a stelle animato (recensioni) ---------- */
  function setStarRating(value) {
    const v = Math.min(5, Math.max(1, Number(value) || 5));
    const hidden = $('#rev-stars');
    if (hidden) hidden.value = String(v);
    $$('#rev-star-rating input[type=radio]').forEach(inp => { inp.checked = Number(inp.value) === v; });
    // Stelle "piene" fino al valore selezionato (label con classe .checked → giallo + ombra nera)
    $$('#rev-star-rating label[data-value]').forEach(lab => {
      lab.classList.toggle('checked', Number(lab.dataset.value) <= v);
    });
    const sv = $('#rev-star-value');
    if (sv) sv.textContent = v + ' / 5';
  }

  function currentStarRating() {
    const checked = $('#rev-star-rating input[type=radio]:checked');
    return checked ? Number(checked.value) : 5;
  }

  function initStarRating() {
    const wrap = $('#rev-star-rating');
    if (!wrap) return;
    wrap.addEventListener('change', (e) => {
      if (e.target && e.target.name === 'rev-stars-radio') setStarRating(e.target.value);
    });
    setStarRating(currentStarRating());
  }

  function resetReviewForm() {
    $('#review-form').reset();
    $('#rev-edit-id').value = '';
    $('#rev-form-title').textContent = 'Aggiungi una recensione';
    $('#rev-cancel-edit').hidden = true;
    const today = new Date().toISOString().slice(0, 10);
    $('#rev-date').value = today;
    setStarRating(5);
  }

  function fillReviewForm(r) {
    $('#rev-edit-id').value = r.id;
    $('#rev-name').value = r.name || '';
    $('#rev-initial').value = (r.initial || '').toUpperCase();
    setStarRating(r.stars || 5);
    $('#rev-date').value = r.date || '';
    $('#rev-text').value = r.description || '';
    $('#rev-form-title').textContent = 'Modifica recensione di ' + reviewDisplayName(r);
    $('#rev-cancel-edit').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveReview(e) {
    e.preventDefault();
    const editId = $('#rev-edit-id').value;
    const data = {
      name: $('#rev-name').value.trim(),
      initial: $('#rev-initial').value.trim().charAt(0).toUpperCase(),
      stars: currentStarRating(),
      date: $('#rev-date').value,
      description: $('#rev-text').value.trim(),
      updatedAt: new Date().toISOString()
    };
    if (!data.name || !data.initial || !data.date || !data.description) {
      toast('Compila tutti i campi della recensione.', true); return;
    }
    setBusy(true);
    try {
      if (editId) {
        await fsSet(REV_COL, editId, data);
        toast('Recensione aggiornata: la Home mostrerà la modifica.');
      } else {
        await fsSet(REV_COL, 'rev-' + Date.now().toString(36), { ...data, createdAt: new Date().toISOString() });
        toast('Recensione salvata: pubblicata automaticamente nella Home.');
      }
      resetReviewForm();
      await loadReviews();
    } catch (err) {
      console.error(err); toast(permHint(err, 'dati'), true);
    } finally { setBusy(false); }
  }

  async function deleteReview(id) {
    const r = allReviews.find(x => x.id === id);
    const okDel = await confirmAction('Eliminare la recensione?',
      `La recensione di ${reviewDisplayName(r || { name: '?', initial: '' })} verrà eliminata definitivamente anche dalla Home.`);
    if (!okDel) return;
    setBusy(true);
    try {
      await fsDelete(REV_COL, id);
      toast('Recensione eliminata dalla Home.');
      await loadReviews();
    } catch (err) {
      console.error(err); toast(permHint(err, 'eliminazione'), true);
    } finally { setBusy(false); }
  }

  function initReviewsSection() {
    initStarRating();
    resetReviewForm();
    $('#review-form').addEventListener('submit', saveReview);
    $('#rev-search').addEventListener('input', renderReviewsTable);
    $('#rev-cancel-edit').addEventListener('click', resetReviewForm);
    $('#reviews-tbody').addEventListener('click', (e) => {
      const ed = e.target.closest('[data-rev-edit]');
      const del = e.target.closest('[data-rev-del]');
      if (ed) { const r = allReviews.find(x => x.id === ed.dataset.revEdit); if (r) fillReviewForm(r); }
      if (del) deleteReview(del.dataset.revDel);
    });
    loadReviews();
  }

  /* ====================== TEST GRATUITO ======================= */
  const QUIZ_COL = 'quiz_questions';
  const CONFIG_COL = 'config';
  const CONFIG_DOC = 'site_config';
  let quizQuestions = [];   // {id, text, answers:[{text, profile}], order, active}
  let quizTitle = '';

  function sortedQuestions() {
    return [...quizQuestions].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  }

  function renderQuestionsList() {
    const list = sortedQuestions();
    $('#quiz-count').textContent = String(list.filter(q => q.active !== false).length);
    const wrap = $('#questions-list');
    wrap.innerHTML = list.map((q, idx) => `
      <div class="q-item ${q.active === false ? 'disabled-q' : ''}">
        <div class="q-item-head">
          <span class="q-num">${idx + 1}.</span>
          <span class="q-text">${esc(q.text)}</span>
          <span class="badge ${q.active === false ? 'badge--off' : 'badge--on'}">${q.active === false ? 'Disattivata' : 'Attiva'}</span>
        </div>
        <ul style="margin:0 0 10px 30px;font-size:13px;color:#555;">
          ${(q.answers || []).map(a => `<li>${esc(a.text)}</li>`).join('')}
        </ul>
        <div class="q-actions" style="margin-left:30px;">
          <button class="btn btn--soft btn--sm" data-q-moveup="${esc(q.id)}" ${idx === 0 ? 'disabled' : ''} title="Sposta su"><i class="fa-solid fa-arrow-up"></i></button>
          <button class="btn btn--soft btn--sm" data-q-movedown="${esc(q.id)}" ${idx === list.length - 1 ? 'disabled' : ''} title="Sposta giù"><i class="fa-solid fa-arrow-down"></i></button>
          <button class="btn btn--soft btn--sm" data-q-toggle="${esc(q.id)}"><i class="fa-solid fa-power-off"></i> ${q.active === false ? 'Attiva' : 'Disattiva'}</button>
          <button class="btn btn--soft btn--sm" data-q-edit="${esc(q.id)}"><i class="fa-solid fa-pen"></i> Modifica</button>
          <button class="btn btn--danger btn--sm" data-q-del="${esc(q.id)}"><i class="fa-solid fa-trash-can"></i> Elimina</button>
        </div>
      </div>`).join('');
    $('#questions-empty').hidden = list.length > 0;
  }

  async function loadQuiz() {
    setBusy(true);
    try {
      quizQuestions = await fsGetAll(QUIZ_COL);
    } catch (e) {
      // Collezione non ancora creata nel nuovo progetto: parte vuota,
      // il seed dai default (o la rete ensureDefaultData) la popola.
      console.warn('loadQuiz getDocs:', e);
      quizQuestions = [];
    }
    try {
      renderQuestionsListAndPreview();
      // titolo: prima site_settings/theme (nuovo progetto), poi config/site_config (legacy)
      quizTitle = window.__defaultQuizTitle || '';
      try {
        const ts = await FB.getDoc(FB.doc(FB.db, 'site_settings', 'theme'));
        const td = ts.exists() ? ts.data() : null;
        if (td && td.quiz && td.quiz.title) quizTitle = td.quiz.title;
      } catch (e2) { /* non critica */ }
      try {
        const snap = await FB.getDoc(FB.doc(FB.db, CONFIG_COL, CONFIG_DOC));
        const cfg = snap.exists() ? snap.data() : {};
        const legacy = (cfg.general && cfg.general.quizTitle) || cfg.quizTitle || '';
        if (legacy) quizTitle = legacy;
      } catch (e3) { /* collection config assente nel nuovo progetto: ignora */ }
      const pt = $('#pv-quiz-title');
      if (pt) pt.textContent = quizTitle || 'Test gratuito';
      // Nessun seed automatico: il test parte VUOTO e le domande si creano
      // solo qui nella dashboard ("Aggiungi domanda"), poi compaiono nel sito.
      if (quizQuestions.length === 0) {
        toast('Test vuoto: aggiungi le domande da questa sezione.', false);
      }
    } catch (e) {
      console.error(e); toast('Errore caricamento test: ' + e.message, true);
    } finally { setBusy(false); }
  }

  // Prima volta: copia le domande predefinite del sito nel database,
  // così l'amministratrice trova il test attuale già importato e modificabile.
  async function seedQuizFromDefaults() {
    const defaults = window.__defaultQuizQuestions || [];
    if (!defaults.length) return;
    setBusy(true);
    try {
      for (let i = 0; i < defaults.length; i++) {
        const q = defaults[i];
        await fsSet(QUIZ_COL, 'q-' + String(i + 1).padStart(2, '0'), {
          text: q.text,
          answers: (q.options || []).map(o => ({ text: o.text, profile: o.score })),
          order: i + 1,
          active: true
        });
      }
      // importa anche il titolo del test in config/site_config (usato dal sito pubblico)
      const cfgPayload = { general: { quizTitle: window.__defaultQuizTitle || '' } };
      await FB.setDoc(FB.doc(FB.db, CONFIG_COL, CONFIG_DOC), cfgPayload, { merge: true });
      quizTitle = window.__defaultQuizTitle || '';
      const ptSeed = $('#pv-quiz-title');
      if (ptSeed) ptSeed.textContent = quizTitle || 'Test gratuito';
      quizQuestions = await fsGetAll(QUIZ_COL);
      renderQuestionsListAndPreview();
      toast('Test attuale importato nel database: ora è modificabile.');
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  }

  /* --- editor risposte nel form domanda (solo testo, senza profili A–D) --- */
  function optionRow(text = '') {
    const div = document.createElement('div');
    div.className = 'opt-row';
    div.innerHTML = `
      <input type="text" value="${esc(text)}" placeholder="Testo della risposta…" data-opt-text />
      <button type="button" class="icon-btn" title="Rimuovi risposta"><i class="fa-solid fa-xmark"></i></button>`;
    div.querySelector('.icon-btn').addEventListener('click', () => {
      if ($('#options-editor').children.length <= 2) { toast('Ogni domanda deve avere almeno 2 risposte.', true); return; }
      div.remove();
    });
    return div;
  }

  function resetQuestionForm() {
    $('#question-form').reset();
    $('#q-edit-key').value = '';
    $('#question-form-title').textContent = 'Crea una nuova domanda';
    $('#q-cancel-edit').hidden = true;
    const ed = $('#options-editor');
    ed.innerHTML = '';
    ed.appendChild(optionRow(''));
    ed.appendChild(optionRow(''));
  }

  function fillQuestionForm(q) {
    $('#q-edit-key').value = q.id;
    $('#q-text').value = q.text || '';
    $('#question-form-title').textContent = 'Modifica domanda';
    $('#q-cancel-edit').hidden = false;
    const ed = $('#options-editor');
    ed.innerHTML = '';
    (q.answers || []).forEach(a => ed.appendChild(optionRow(a.text)));
    if (!(q.answers || []).length) { ed.appendChild(optionRow('')); ed.appendChild(optionRow('')); }
    document.getElementById('panel-test').scrollIntoView({ behavior: 'smooth' });
  }

  async function saveQuestion(e) {
    e.preventDefault();
    const key = $('#q-edit-key').value || ('q-' + Date.now().toString(36));
    const text = $('#q-text').value.trim();
    const answers = $$('#options-editor .opt-row').map(row => ({
      text: row.querySelector('[data-opt-text]').value.trim()
    })).filter(a => a.text);
    if (!text) { toast('Inserisci il testo della domanda.', true); return; }
    if (answers.length < 2) { toast('Servono almeno 2 risposte con testo.', true); return; }
    const existing = quizQuestions.find(q => q.id === key);
    const order = existing ? Number(existing.order) : (sortedQuestions().length + 1);
    setBusy(true);
    try {
      await fsSet(QUIZ_COL, key, { text, answers, order, active: existing ? existing.active !== false : true });
      toast('Domanda salvata: disponibile nel test pubblico.');
      resetQuestionForm();
      quizQuestions = await fsGetAll(QUIZ_COL);
      renderQuestionsListAndPreview();
    } catch (err) { console.error(err); toast(permHint(err, 'dati'), true); }
    finally { setBusy(false); }
  }

  async function deleteQuestion(id) {
    const q = quizQuestions.find(x => x.id === id);
    const okDel = await confirmAction('Eliminare la domanda?',
      `"${(q && q.text || '').slice(0, 80)}…" verrà rimossa definitivamente dal test pubblico.`);
    if (!okDel) return;
    setBusy(true);
    try {
      await fsDelete(QUIZ_COL, id);
      toast('Domanda eliminata dal test.');
      quizQuestions = await fsGetAll(QUIZ_COL);
      renderQuestionsListAndPreview();
    } catch (err) { console.error(err); toast(permHint(err, 'eliminazione'), true); }
    finally { setBusy(false); }
  }

  async function reorderQuestion(id, dir) {
    const list = sortedQuestions();
    const idx = list.findIndex(q => q.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= list.length) return;
    setBusy(true);
    try {
      const a = list[idx], b = list[swap];
      const ao = Number(a.order), bo = Number(b.order);
      // normalizza gli ordini se sovrapposti
      const newA = { ...a, order: bo }, newB = { ...b, order: ao };
      await Promise.all([
        fsSet(QUIZ_COL, a.id, { order: newA.order }),
        fsSet(QUIZ_COL, b.id, { order: newB.order })
      ]);
      quizQuestions = await fsGetAll(QUIZ_COL);
      renderQuestionsListAndPreview();
      toast('Ordine aggiornato: il test pubblico segue il nuovo ordine.');
    } catch (err) { console.error(err); toast(permHint(err, 'riordino'), true); }
    finally { setBusy(false); }
  }

  async function toggleQuestion(id) {
    const q = quizQuestions.find(x => x.id === id);
    if (!q) return;
    setBusy(true);
    try {
      await fsSet(QUIZ_COL, id, { active: q.active === false });
      q.active = q.active === false;
      renderQuestionsListAndPreview();
      toast(q.active ? 'Domanda riattivata nel test.' : 'Domanda disattivata: non comparirà nel test.');
    } catch (err) { console.error(err); toast('Errore: ' + err.message, true); }
    finally { setBusy(false); }
  }

  function initQuizSection() {
    resetQuestionForm();
    $('#question-form').addEventListener('submit', saveQuestion);
    $('#q-cancel-edit').addEventListener('click', resetQuestionForm);
    $('#btn-add-option').addEventListener('click', () => $('#options-editor').appendChild(optionRow()));
    $('#questions-list').addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.qEdit) { const q = quizQuestions.find(x => x.id === t.dataset.qEdit); if (q) fillQuestionForm(q); }
      else if (t.dataset.qDel) deleteQuestion(t.dataset.qDel);
      else if (t.dataset.qToggle) toggleQuestion(t.dataset.qToggle);
      else if (t.dataset.qMoveup) reorderQuestion(t.dataset.qMoveup, -1);
      else if (t.dataset.qMovedown) reorderQuestion(t.dataset.qMovedown, +1);
    });
    loadQuiz();
  }

  /* =================== SERVIZI E PACCHETTI ==================== */
  const PKG_COL = 'service_packages';
  const CQ_COL = 'service_form_questions';
  const REQ_COL = 'service_requests';
  let packages = [];
  let customQuestions = [];
  let requests = [];

  function pkgSorted() {
    return [...packages].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  }

  function renderPackages() {
    const list = pkgSorted();
    $('#packages-tbody').innerHTML = list.map((p, idx) => `
      <tr>
        <td style="white-space:nowrap;">
          <button class="btn btn--soft btn--sm" data-pkg-moveup="${esc(p.id)}" ${idx === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
          <button class="btn btn--soft btn--sm" data-pkg-movedown="${esc(p.id)}" ${idx === list.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
        </td>
        <td><strong>${esc(p.name)}</strong></td>
        <td>${esc(p.price || '—')}</td>
        <td><span class="badge ${p.active === false ? 'badge--off' : 'badge--on'}">${p.active === false ? 'Off' : 'On'}</span></td>
        <td><span class="badge ${p.showInHome === false ? 'badge--off' : 'badge--on'}">${p.showInHome === false ? 'No' : 'Sì'}</span></td>
        <td>${(p.questionKeys || []).length ? (p.questionKeys || []).length + ' domande collegate' : '<span style="color:#999;">nessuna</span>'}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn--soft btn--sm" data-pkg-edit="${esc(p.id)}"><i class="fa-solid fa-pen"></i> Modifica</button>
          <button class="btn btn--soft btn--sm" data-pkg-new="${esc(p.id)}" title="Duplica come nuovo pacchetto"><i class="fa-regular fa-copy"></i></button>
          <button class="btn btn--soft btn--sm" data-pkg-toggle="${esc(p.id)}" title="Attiva/disattiva"><i class="fa-solid fa-power-off"></i></button>
          <button class="btn btn--danger btn--sm" data-pkg-del="${esc(p.id)}"><i class="fa-solid fa-trash-can"></i></button>
        </td>
      </tr>`).join('');
  }

  function renderRequests() { /* sezione rimossa dalla dashboard */ }

  async function loadServices() {
    setBusy(true);
    try {
      // Ogni collezione viene letta in modo indipendente: se una non esiste
      // ancora nel nuovo progetto, le altre si caricano comunque.
      const [pkgs, cqs] = await Promise.all([
        fsGetAll(PKG_COL).catch(e => { console.warn('pkg:', e); return []; }),
        fsGetAll(CQ_COL).catch(e => { console.warn('cq:', e); return []; })
      ]);
      packages = pkgs; customQuestions = cqs;
      renderPackagesAndPreview();
      if (packages.length === 0) {
        try { await seedPackagesFromDefaults(); }
        catch (e2) { console.warn('seedPackages:', e2); }
      }
    } catch (e) {
      console.error(e); toast('Errore caricamento servizi: ' + e.message, true);
    } finally { setBusy(false); }
  }

  // Prima volta: importa nella collezione 'service_packages' i pacchetti
  // attualmente presenti nel sito, così sono subito modificabili.
  async function seedPackagesFromDefaults() {
    const defs = window.__defaultServicePackages || [];
    if (!defs.length) return;
    setBusy(true);
    try {
      for (let i = 0; i < defs.length; i++) {
        const p = defs[i];
        await fsSet(PKG_COL, 'pkg-' + p.key, {
          key: p.key, name: p.title, type: p.type, desc: p.desc,
          price: p.price || '', features: p.features || [],
          order: i + 1, active: true, showInHome: true, questionKeys: []
        });
      }
      packages = await fsGetAll(PKG_COL);
      renderPackagesAndPreview();
      toast('Pacchetti attuali importati: ora puoi modificarli.');
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  }

  /* --- selettore icone pacchetto (dashboard Servizi) --- */
  const PKG_ICONS = {
    singolo:   '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7.5" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>',
    coppia:    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="7" r="3"/><circle cx="17" cy="8" r="2.5"/><path d="M2.5 20v-1.5a6.5 6.5 0 0 1 13 0V20M15 14a5 5 0 0 1 6.5 4.5V20"/></svg>',
    gruppo:    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="3"/><circle cx="5" cy="9" r="2.3"/><circle cx="19" cy="9" r="2.3"/><path d="M6.5 20v-1a5.5 5.5 0 0 1 11 0v1M1 19v-1a4 4 0 0 1 4-4M23 19v-1a4 4 0 0 0-4-4"/></svg>',
    documento: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/></svg>',
    digitale:  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="13" rx="2"/><path d="M8 21h8M12 16v5M7 8h4M7 11h7M17 7v4"/></svg>',
    calendario:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/></svg>',
    obiettivo: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/><path d="m14 10 6-6M16 4h4v4"/></svg>',
    messaggio: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-12.7 7.4L3 21l1.8-5.3A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8 12h8M8 9h5"/></svg>'
  };
  function pkgIconSvg(key, fallbackKey) {
    return PKG_ICONS[key] || PKG_ICONS[fallbackKey] || PKG_ICONS.singolo;
  }
  function setPkgIconSelection(key) {
    const k = PKG_ICONS[key] ? key : 'singolo';
    const hidden = $('#pkg-icon-key'); if (hidden) hidden.value = k;
    const preview = $('#previewIcon'); if (preview) preview.innerHTML = PKG_ICONS[k];
    const labelEl = $('#selectedLabel'), valueEl = $('#selectedValue');
    document.querySelectorAll('.icon-option').forEach(opt => {
      const on = opt.dataset.icon === k;
      opt.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (on && labelEl) labelEl.textContent = opt.dataset.label;
    });
    if (valueEl) valueEl.textContent = k;
  }
  function initIconPicker() {
    const opts = document.querySelectorAll('.icon-option');
    if (!opts.length) return;
    opts.forEach(opt => opt.addEventListener('click', () => {
      setPkgIconSelection(opt.dataset.icon);
      scheduleDraftRender(); // l'anteprima live del pacchetto si aggiorna subito
    }));
    setPkgIconSelection($('#pkg-icon-key') ? $('#pkg-icon-key').value : 'singolo');
  }

  /* --- editor punti elenco: un input per riga (come le risposte del test) --- */
  function featureRow(text = '') {
    const div = document.createElement('div');
    div.className = 'opt-row';
    div.innerHTML = `
      <input type="text" value="${esc(text)}" placeholder="Es. Incontro di 90 minuti" data-feat-text />
      <button type="button" class="icon-btn" title="Rimuovi punto elenco"><i class="fa-solid fa-xmark"></i></button>`;
    div.querySelector('.icon-btn').addEventListener('click', () => div.remove());
    div.querySelector('input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); $('#features-editor').appendChild(featureRow('')); }
    });
    return div;
  }
  function featureTexts() {
    return $$('#features-editor [data-feat-text]').map(i => i.value.trim()).filter(Boolean);
  }

  function resetPackageForm() {
    $('#package-form').reset();
    $('#pkg-edit-key').value = '';
    $('#pkg-form-title').textContent = 'Aggiungi un nuovo pacchetto';
    $('#pkg-cancel-edit').hidden = true;
    $('#pkg-active').checked = true;
    $('#pkg-visible').checked = true;
    const fe = $('#features-editor');
    fe.innerHTML = '';
    fe.appendChild(featureRow(''));
    setPkgIconSelection('singolo');
  }

  function fillPackageForm(p, asNew) {
    if (asNew) {
      // modalità «duplica»: crea un pacchetto nuovo precompilato
      $('#pkg-edit-key').value = '';
    } else {
      $('#pkg-edit-key').value = p.id;
    }
    $('#pkg-name').value = p.name || '';
    $('#pkg-price').value = p.price || '';
    const fe = $('#features-editor');
    fe.innerHTML = '';
    (p.features || []).forEach(f => fe.appendChild(featureRow(f)));
    if (!(p.features || []).length) fe.appendChild(featureRow(''));
    $('#pkg-tag').value = p.tag || '';
    setPkgIconSelection(p.iconKey || 'singolo');
    $('#pkg-active').checked = p.active !== false;
    $('#pkg-visible').checked = p.showInHome !== false;
    $('#pkg-form-title').textContent = asNew ? 'Duplica pacchetto: ' + p.name : (p.id ? 'Modifica pacchetto: ' + p.name : 'Aggiungi un nuovo pacchetto');
    $('#pkg-cancel-edit').hidden = !p.id;
    document.getElementById('panel-servizi').scrollIntoView({ behavior: 'smooth' });
  }

  async function savePackage(e) {
    e.preventDefault();
    const editId = $('#pkg-edit-key').value;
    const existing = editId ? packages.find(p => p.id === editId) : null;
    // Identificativo generato automaticamente: non serve scriverlo nel form
    const key = existing ? (existing.key || editId) : ('pkg-' + Date.now().toString(36));
    const docId = editId || key;
    const data = {
      key,
      name: $('#pkg-name').value.trim(),
      price: $('#pkg-price').value.trim(),
      features: featureTexts(),
      tag: $('#pkg-tag').value.trim(),
      iconKey: ($('#pkg-icon-key') && $('#pkg-icon-key').value) || 'singolo',
      actionUrl: existing ? (existing.actionUrl || '') : '',
      active: $('#pkg-active').checked,
      showInHome: $('#pkg-visible').checked,
      questionKeys: existing ? (existing.questionKeys || []) : [],
      order: existing ? Number(existing.order) : (pkgSorted().length + 1)
    };
    setBusy(true);
    try {
      await fsSet(PKG_COL, docId, data); // setDoc usa merge:true → non perde i campi non esposti nel form
      toast('Pacchetto salvato: aggiornato nella Home e nel popup.');
      resetPackageForm();
      packages = await fsGetAll(PKG_COL);
      renderPackagesAndPreview();
    } catch (err) { console.error(err); toast(permHint(err, 'dati'), true); }
    finally { setBusy(false); }
  }

  async function deletePackage(id) {
    const p = packages.find(x => x.id === id);
    const okDel = await confirmAction('Eliminare il pacchetto?',
      `"${p && p.name}" non sarà più mostrato nella Home né disponibile per le richieste.`);
    if (!okDel) return;
    setBusy(true);
    try {
      await fsDelete(PKG_COL, id);
      toast('Pacchetto eliminato.');
      packages = await fsGetAll(PKG_COL);
      renderPackagesAndPreview();
    } catch (err) { console.error(err); toast(permHint(err, 'eliminazione'), true); }
    finally { setBusy(false); }
  }

  async function togglePackage(id) {
    const p = packages.find(x => x.id === id);
    if (!p) return;
    setBusy(true);
    try {
      const newState = p.active === false;
      await fsSet(PKG_COL, id, { active: newState, showInHome: newState ? (p.showInHome !== false) : false });
      p.active = newState; p.showInHome = newState ? p.showInHome !== false : false;
      renderPackagesAndPreview();
      toast(newState ? 'Pacchetto attivato.' : 'Pacchetto disattivato: nascosto dalla Home.');
    } catch (err) { console.error(err); toast('Errore: ' + err.message, true); }
    finally { setBusy(false); }
  }

  async function movePackage(id, dir) {
    const list = pkgSorted();
    const idx = list.findIndex(p => p.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= list.length) return;
    const a = list[idx], b = list[swap];
    setBusy(true);
    try {
      await Promise.all([
        fsSet(PKG_COL, a.id, { order: Number(b.order) }),
        fsSet(PKG_COL, b.id, { order: Number(a.order) })
      ]);
      packages = await fsGetAll(PKG_COL);
      renderPackagesAndPreview();
      toast('Ordine aggiornato nella Home.');
    } catch (err) { console.error(err); }
    finally { setBusy(false); }
  }

  function initServicesSection() {
    resetPackageForm();
    initIconPicker();
    $('#package-form').addEventListener('submit', savePackage);
    $('#btn-add-feature').addEventListener('click', () => $('#features-editor').appendChild(featureRow('')));
    $('#pkg-cancel-edit').addEventListener('click', () => { resetPackageForm(); });
    $('#packages-tbody').addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.pkgNew) {
        // «Duplica» parte dai dati del pacchetto ma come NUOVO elemento:
        // apre il form di aggiunta già compilato, senza chiave né editId.
        const p = packages.find(x => x.id === t.dataset.pkgNew);
        if (p) fillPackageForm({ ...p, id: '', key: p.key + '-copia', name: p.name + ' (copia)' }, true);
      }
      else if (t.dataset.pkgEdit) { const p = packages.find(x => x.id === t.dataset.pkgEdit); if (p) fillPackageForm(p); }
      else if (t.dataset.pkgDel) deletePackage(t.dataset.pkgDel);
      else if (t.dataset.pkgToggle) togglePackage(t.dataset.pkgToggle);
      else if (t.dataset.pkgMoveup) movePackage(t.dataset.pkgMoveup, -1);
      else if (t.dataset.pkgMovedown) movePackage(t.dataset.pkgMovedown, +1);
    });
    // NOTA: il contenitore delle domande personalizzate non è più presente
    // nell'HTML della dashboard. Senza questo controllo il listener lanciava
    // un TypeError che interrompeva initDashboard: "Colori & stile" e
    // "Aggiornamenti foto" non venivano mai inizializzati (pulsanti non
    // reattivi). Ora tutto è protetto e la sezione resta opzionale.
    const cqList = $('#custom-questions-list');
    if (cqList) cqList.addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.cqDel) deleteCustomQuestion(t.dataset.cqDel);
      else if (t.dataset.cqToggleReq) toggleCustomRequired(t.dataset.cqToggleReq);
    });
    // collega/scollega una domanda personalizzata a un singolo pacchetto
    if (cqList) cqList.addEventListener('change', async (e) => {
      const cb = e.target.closest('[data-cq-pkg]');
      if (!cb) return;
      const qid = cb.dataset.cqPkg, pkgIdAttr = cb.dataset.pkg;
      const pkg = packages.find(x => (x.key || x.id) === pkgIdAttr);
      if (!pkg) return;
      const keys = new Set(pkg.questionKeys || []);
      cb.checked ? keys.add(qid) : keys.delete(qid);
      setBusy(true);
      try {
        await fsSet(PKG_COL, pkg.id, { questionKeys: Array.from(keys) });
        pkg.questionKeys = Array.from(keys);
        renderPackagesAndPreview();
        toast(cb.checked ? 'Domanda collegata al pacchetto.' : 'Domanda scollegata dal pacchetto.');
      } catch (err) { console.error(err); toast(permHint(err, 'collegamento'), true); }
      finally { setBusy(false); }
    });
    loadServices();
  }

  /* ============ ANTEPRIMA LIVE «A RICHIESTA» =====================
     La colonna di destra non mostra più tutto insieme: resta vuota finché
     l'utente non inizia a compilare i campi della sezione attiva. Appena
     digita (o modifica un colore, aggiunge una foto…) compare SOLO
     l'anteprima di quella sezione. Ogni blocco della colonna dichiara a
     quale sezione appartiene con data-preview="...".                     */
  const PREVIEW_PANEL_LABELS = {
    recensioni: 'Recensioni',
    test: 'Test gratuito',
    servizi: 'Servizi e pacchetti',
    colori: 'Colori & stile',
    foto: 'Aggiornamenti foto',
    social: 'Aggiornamento social',
    faq: 'FAQ'
  };
  let activePanelKey = 'recensioni';
  const previewActivated = {};

  function updatePreviewGate() {
    const blocks = $$('#preview-pane .pv-block');
    if (!blocks.length) return;
    const own = blocks.filter(b => b.dataset.preview === activePanelKey);
    const show = own.length > 0 && !!previewActivated[activePanelKey];
    blocks.forEach(b => { b.hidden = !(show && b.dataset.preview === activePanelKey); });
    const empty = $('#pv-empty-state');
    const emptyText = $('#pv-empty-text');
    if (!empty || !emptyText) return;
    empty.hidden = show;
    if (show) return;
    const label = PREVIEW_PANEL_LABELS[activePanelKey] || '';
    emptyText.innerHTML = own.length
      ? 'Anteprima in attesa: inizia a compilare i campi di «' + label + '» e qui vedrai il risultato in tempo reale.'
      : 'La sezione «' + label + '» non ha un\'anteprima: le recensioni salvate si vedono direttamente nella Home, nella sezione «Cosa dicono di me».';
  }

  function activatePreview(key) {
    if (!key || previewActivated[key]) return;
    previewActivated[key] = true;
    updatePreviewGate();
    try { renderDrafts(); } catch (err) { /* l'anteprima non blocca mai la scrittura */ }
  }

  function initPreviewGate() {
    activePanelKey = 'recensioni';
    $$('.panel').forEach(panel => {
      const key = panel.id.replace('panel-', '');
      panel.addEventListener('input', () => activatePreview(key));
      panel.addEventListener('change', () => activatePreview(key));
      // Anche un click su un pulsante della sezione (aggiungi, salva, modifica…)
      // è un'azione esplicita: mostra l'anteprima di quella sezione.
      panel.addEventListener('click', (e) => {
        if (e.target.closest('button')) activatePreview(key);
      });
    });
    updatePreviewGate();
  }

  /* ========================= NAVIGATION ======================== */
  function switchPanel(name) {
    $$('.side-btn').forEach(b => b.classList.toggle('active', b.dataset.panel === name));
    $$('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + name));
    // Cambiando sezione l'anteprima torna vuota finché non si scrive di nuovo.
    activePanelKey = name;
    previewActivated[name] = false;
    updatePreviewGate();
    // La sidebar è scrollabile: se la voce attiva è fuori vista (es. FAQ in fondo),
    // portala in vista così l'utente capisce sempre dove si trova.
    const active = document.querySelector('.side-btn.active');
    const sb = document.querySelector('.sidebar');
    if (active && sb && sb.scrollHeight > sb.clientHeight) {
      sb.classList.add('scrolled-to-active');
      const ar = active.getBoundingClientRect(), sr = sb.getBoundingClientRect();
      if (ar.top < sr.top + 8 || ar.bottom > sr.bottom - 8) {
        sb.scrollTo({ top: sb.scrollTop + (ar.top - sr.top) - sb.clientHeight / 2 + ar.height / 2, behavior: 'smooth' });
      }
    }
  }

  /* ===================== ANTEPRIMA LIVE (destra) ==================
     Ricrea in miniatura ciò che la Home pubblica mostra: recensioni,
     pacchetti attivi/visibili e domande attive del test. I colori dei
     pacchetti seguono il tema corrente (applyPreviewTheme).            */
  function renderLivePreview() {
    // Dopo un salvataggio o un refresh, la "bozza" non serve più: il contenuto
    // reale compare già nella lista sottostante.
    renderDraftsCleared();
    // --- Pacchetti attivi e visibili nella Home (stile identico alla Home) ---
    const pkgBox = $('#pv-packages');
    if (pkgBox) {
      const visible = pkgSorted().filter(p => p.active !== false && p.showInHome !== false);
      pkgBox.innerHTML = visible.length
        ? visible.map((p, i) => pvServiceCardHtml(p, p.featured || p.key === 'piano-autonomo')).join('')
        : '<p class="pv-empty">Nessun pacchetto attivo e visibile nella Home.</p>';
    }
    // --- Anteprima del test: replica il popup del sito (domanda + risposte) ---
    const quizBox = $('#pv-quiz');
    if (quizBox) {
      const qs = sortedQuestions();
      quizBox.innerHTML = qs.length
        ? qs.map((q, i) => `
          <div class="pvq-modal${q.active === false ? ' pvq-off' : ''}">
            <div class="pvq-qnum">Domanda ${i + 1} di ${qs.length}${q.active === false ? ' · <span style="color:#b0483a;">disattivata</span>' : ''}</div>
            <div class="pvq-qtext">${esc(q.text)}</div>
            ${(q.answers || []).map(a => `
              <div class="pvq-answer"><span>${esc(a.text)}</span></div>`).join('')}
          </div>`).join('')
        : '<p class="pv-empty">Nessuna domanda nel database. Aggiungine una dal modulo «Crea una nuova domanda».</p>';
    }
    // --- FAQ attive, in ordine (sezione «Le risposte che cercavi») ---
    const faqBox = $('#pv-faq');
    if (faqBox) {
      const fs = sortedFaqs().filter(f => f.active !== false);
      faqBox.innerHTML = fs.length
        ? fs.map((f, i) => `
          <div class="pv-q">
            <span class="pv-num">${String(i + 1).padStart(2, '0')}</span>
            <span>${esc(f.question)}</span>
          </div>`).join('')
        : '<p class="pv-empty">Nessuna domanda FAQ attiva nel database.</p>';
    }
    // --- Foto in Home: hero / chi sono / studio (stile fedele al sito) ---
    renderPhotosPreview();
  }

  /* =============== SEZIONE: FAQ (Home «Le risposte che cercavi») =========
     Le domande frequenti sono salvate nella collection Firestore 'faq'.
     La Home le legge e sostituisce l'accordion statico; qui si aggiungono,
     modificano, eliminano, riordinano e attivano/disattivano.            */
  const FAQ_COL = 'faq';
  let allFaqs = [];
  let faqEditId = null;

  function sortedFaqs() {
    return [...allFaqs].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  }

  async function loadFaq() {
    try {
      allFaqs = await fsGetAll(FAQ_COL);
    } catch (e) {
      console.warn('faq:', e);
      allFaqs = []; // collezione non ancora creata: si parte vuoti, nessun errore bloccante
    }
    renderFaqList();
    renderLivePreview();
  }

  function faqRowHtml(f, i, total) {
    const off = f.active === false;
    return `
      <div class="pkg-row" data-faq-id="${esc(f.id)}" style="border-bottom:1px solid #eee7d9;padding:10px 0;${off ? 'opacity:.55;' : ''}">
        <div style="display:flex;gap:8px;align-items:flex-start;">
          <span style="font-weight:700;color:#2f4f3e;min-width:30px;">${String(i + 1).padStart(2, '0')}</span>
          <div style="flex:1;min-width:0;">
            <strong style="display:block;font-size:13.5px;color:var(--antracite);">${esc(f.question)}</strong>
            <span style="display:block;font-size:12px;color:#98917f;margin-top:2px;white-space:pre-line;max-height:64px;overflow:hidden;">${esc(f.answer || '')}</span>
            ${off ? '<span style="font-size:11px;color:#b45309;">disattivata (non compare nella Home)</span>' : ''}
          </div>
        </div>
        <div class="row" style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
          <button type="button" class="btn btn--soft btn--sm" data-act="up" ${i === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
          <button type="button" class="btn btn--soft btn--sm" data-act="down" ${i === total - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
          <button type="button" class="btn btn--soft btn--sm" data-act="toggle"><i class="fa-solid ${off ? 'fa-toggle-off' : 'fa-toggle-on'}"></i> ${off ? 'Attiva' : 'Disattiva'}</button>
          <button type="button" class="btn btn--soft btn--sm" data-act="edit"><i class="fa-solid fa-pen"></i> Modifica</button>
          <button type="button" class="btn btn--danger btn--sm" data-act="del"><i class="fa-solid fa-trash-can"></i> Elimina</button>
        </div>
      </div>`;
  }

  function renderFaqList() {
    const box = $('#faq-list');
    if (!box) return;
    const list = sortedFaqs();
    const st = $('#faq-status');
    if (st) st.textContent = list.length
      ? `${list.length} domande (${list.filter(f => f.active !== false).length} attive).`
      : 'Nessuna domanda nel database: aggiungine una qui sopra, comparirà nella Home.';
    box.innerHTML = list.map((f, i) => faqRowHtml(f, i, list.length)).join('') ||
      '<p class="pv-empty" style="font-size:12.5px;color:#98917f;">Elenco vuoto.</p>';
  }

  function resetFaqForm() {
    faqEditId = null;
    const q = $('#faq-q'), a = $('#faq-a');
    if (q) q.value = '';
    if (a) a.value = '';
    const badge = $('#faq-editing-badge'), cancel = $('#btn-faq-cancel-edit'), add = $('#btn-faq-add');
    if (badge) badge.style.display = 'none';
    if (cancel) cancel.hidden = true;
    if (add) add.innerHTML = '<i class="fa-solid fa-plus"></i> Salva domanda';
  }

  async function saveFaq() {
    const question = ($('#faq-q').value || '').trim();
    const answer = ($('#faq-a').value || '').trim();
    if (!question) { toast('Scrivi almeno la domanda.', true); return; }
    if (!answer) { toast('Scrivi anche la risposta: è il testo che il visitatore leggerà aprendo la domanda.', true); return; }
    setBusy(true);
    try {
      if (faqEditId) {
        await fsSet(FAQ_COL, faqEditId, { question, answer });
        toast('Domanda aggiornata: la Home si aggiorna subito.');
      } else {
        const maxOrder = sortedFaqs().reduce((m, f) => Math.max(m, Number(f.order) || 0), 0);
        await fsSet(FAQ_COL, 'faq-' + Date.now().toString(36), { question, answer, order: maxOrder + 1, active: true });
        toast('Domanda pubblicata nella sezione FAQ della Home.');
      }
      resetFaqForm();
      renderDraftsCleared();
      await loadFaq();
    } catch (err) {
      console.error(err);
      toast(permHint(err, 'salvataggio FAQ'), true);
    } finally { setBusy(false); }
  }

  async function moveFaq(id, dir) {
    const list = sortedFaqs();
    const i = list.findIndex(f => f.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    const a = list[i], b = list[j];
    setBusy(true);
    try {
      await Promise.all([
        fsSet(FAQ_COL, a.id, { order: b.order == null ? j : Number(b.order) }),
        fsSet(FAQ_COL, b.id, { order: a.order == null ? i : Number(a.order) })
      ]);
      await loadFaq();
    } catch (err) { console.error(err); toast(permHint(err, 'riordino'), true); }
    finally { setBusy(false); }
  }

  async function toggleFaq(id) {
    const f = allFaqs.find(x => x.id === id);
    if (!f) return;
    setBusy(true);
    try {
      await fsSet(FAQ_COL, id, { active: f.active === false });
      await loadFaq();
      toast(f.active === false ? 'Domanda riattivata nella Home.' : 'Domanda disattivata: non comparirà più nella Home.');
    } catch (err) { console.error(err); toast(permHint(err, 'attivazione'), true); }
    finally { setBusy(false); }
  }

  async function deleteFaq(id) {
    const f = allFaqs.find(x => x.id === id);
    if (!f) return;
    const okDel = await confirmAction('Eliminare la domanda?',
      `«${f.question}» verrà rimossa dalla sezione FAQ della Home. L'azione è definitiva.`);
    if (!okDel) return;
    setBusy(true);
    try {
      await fsDelete(FAQ_COL, id);
      if (faqEditId === id) resetFaqForm();
      await loadFaq();
      toast('Domanda eliminata.');
    } catch (err) { console.error(err); toast(permHint(err, 'eliminazione'), true); }
    finally { setBusy(false); }
  }

  function initFaqSection() {
    const addBtn = $('#btn-faq-add');
    if (addBtn) addBtn.addEventListener('click', saveFaq);
    const cancelBtn = $('#btn-faq-cancel-edit');
    if (cancelBtn) cancelBtn.addEventListener('click', resetFaqForm);
    const list = $('#faq-list');
    if (list) {
      list.addEventListener('click', async (e) => {
        const btn = e.target.closest('button[data-act]');
        if (!btn) return;
        const row = btn.closest('[data-faq-id]');
        if (!row) return;
        const id = row.dataset.faqId;
        const act = btn.dataset.act;
        if (act === 'up') moveFaq(id, -1);
        else if (act === 'down') moveFaq(id, 1);
        else if (act === 'toggle') toggleFaq(id);
        else if (act === 'del') deleteFaq(id);
        else if (act === 'edit') {
          const f = allFaqs.find(x => x.id === id);
          if (!f) return;
          faqEditId = id;
          $('#faq-q').value = f.question || '';
          $('#faq-a').value = f.answer || '';
          $('#faq-editing-badge').style.display = '';
          $('#btn-faq-cancel-edit').hidden = false;
          $('#btn-faq-add').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salva modifiche';
          $('#faq-card').scrollIntoView({ behavior: 'smooth' });
          $('#faq-q').focus();
        }
      });
    }
    loadFaq();
  }

  /* ============ SEZIONE: AGGIORNAMENTI FOTO ==============
     Le foto della Home (Hero, Chi sono, Il mio Studio) sono salvate in
     Firestore (collection 'site_photos', doc 'home'). Ogni slot è un URL
     che l'amministratrice incolla; script.js della Home le legge e le usa
     negli slideshow al posto dei default. */
  const PHOTOS_COL = 'site_photos';
  const PHOTOS_DOC = 'home';

  const PHOTOS_DEFAULTS = {
    hero: [
      'https://raw.githubusercontent.com/mentalcoachvaleria-arch/Galleria-per-sito-web/main/1-fatto.png',
      'https://raw.githubusercontent.com/mentalcoachvaleria-arch/Galleria-per-sito-web/main/2-fatto.png',
      'https://raw.githubusercontent.com/mentalcoachvaleria-arch/Galleria-per-sito-web/main/3-fatto.png'
    ],
    about: [
      'https://raw.githubusercontent.com/mentalcoachvaleria-arch/Galleria-per-sito-web/main/2-fatto.png',
      'https://raw.githubusercontent.com/mentalcoachvaleria-arch/Galleria-per-sito-web/main/1-fatto.png'
    ],
    studio: [
      'https://raw.githubusercontent.com/mentalcoachvaleria-arch/Galleria-per-sito-web/main/3-fatto.png'
    ]
  };

  const PHOTO_GROUPS = [
    { key: 'hero',   slots: '#hero-slots',   label: 'Foto Hero — Home «Trasforma i tuoi obiettivi…»', max: 6 },
    { key: 'about',  slots: '#about-slots',  label: 'Foto «Chi sono — Ciao, sono Valeria»', max: 4 },
    { key: 'studio', slots: '#studio-slots', label: 'Foto «Il mio Studio»', max: 6 }
  ];

  let currentPhotos = JSON.parse(JSON.stringify(PHOTOS_DEFAULTS));

  function validPhotoUrl(u) {
    u = String(u || '').trim();
    return /^https?:\/\/.+/i.test(u) ? u : '';
  }

  function photoSlotHtml(groupKey, url, idx, total) {
    const isStudio = groupKey === 'studio';
    const ratio = groupKey === 'about' ? 'aspect-ratio:3/4;' : 'aspect-ratio:4/5;';
    return `
      <div class="photo-slot" data-group="${groupKey}" data-idx="${idx}" style="display:flex;gap:12px;align-items:center;margin-bottom:10px;">
        <div class="photo-thumb" style="width:74px;flex-shrink:0;border-radius:12px;overflow:hidden;border:1px solid #ddd6c6;background:#efe9dd;${ratio}display:flex;align-items:center;justify-content:center;">
          ${url ? `<img src="${esc(url)}" alt="" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'" />` : '<i class="fa-regular fa-image" style="color:#b3ab97;font-size:18px;"></i>'}
        </div>
        <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
          <input type="url" class="input photo-url-input" data-group="${groupKey}" data-idx="${idx}"
                 placeholder="Incolla qui il link (https://…) della foto ${idx + 1}" value="${esc(url)}" />
          <span style="font-size:10.5px;color:#98917f;">${isStudio ? (total > 1 ? `Foto ${idx + 1} di ${total} · ruota ogni 4 secondi nella pagina Studio.` : 'Questa foto compare nella sezione «Il mio Studio» della Home.') : `Foto ${idx + 1} di ${total} · ruota ogni 4 secondi nella Home.`}</span>
        </div>
        <button type="button" class="btn btn--soft btn--sm photo-remove-btn" data-group="${groupKey}" data-idx="${idx}" title="Rimuovi questa foto" ${total <= 1 && !isStudio ? 'disabled' : ''}><i class="fa-solid fa-xmark"></i></button>
      </div>`;
  }

  /* Contatore "forzato": quanti slot vuoti in più mostrare per gruppo.
     Serve perché "Aggiungi un'altra foto" crei SEMPRE un nuovo campo, anche
     se l'anteprima live del sito mostra solo le foto effettivamente salvate. */
  const photoExtraSlots = { hero: 0, about: 0, studio: 0 };

  /* Stato "veritiero" delle liste foto: è alimentato SOLO da Firestore e
     dalle azioni esplicite (aggiungi/rimuovi/salva), MAI dal DOM. In questo
     modo nessun aggiornamento in tempo reale può cancellare le righe create
     con "Aggiungi un'altra foto". */
  const photoState = { hero: [], about: [], studio: [] };

  function syncPhotoStateFromDom(groupKey) {
    const inputs = $$('.photo-url-input').filter(i => i.dataset.group === groupKey);
    const vals = inputs.map(i => String(i.value || '').trim());
    const filledCount = (photoState[groupKey] || []).filter(Boolean).length;
    const merged = [];
    for (let i = 0; i < vals.length; i++) merged.push(vals[i]);
    // se per qualche motivo il DOM ha meno righe dello stato, recupera le mancanti
    for (let i = vals.length; i < filledCount; i++) merged.push(photoState[groupKey][i] || '');
    photoState[groupKey] = merged;
    currentPhotos[groupKey] = merged.map(validPhotoUrl).filter(Boolean);
  }

  function renderPhotoSlots() {
    PHOTO_GROUPS.forEach(g => {
      const box = $(g.slots);
      if (!box) return;
      const list = photoState[g.key] || [];
      const filled = list.filter(Boolean);
      const emptyExtras = Math.max(0, list.length - filled.length);
      const urls = filled;
      // Slot vuoti extra richiesti con "Aggiungi un'altra foto"
      const extra = Math.min(photoExtraSlots[g.key] || 0, 12 - urls.length);
      const total = urls.length + Math.max(emptyExtras, extra);
      if (total === 0) {
        box.innerHTML = photoSlotHtml(g.key, '', 0, 1);
        return;
      }
      const rows = urls.map((u, i) => photoSlotHtml(g.key, u, i, total))
        .concat(Array.from({ length: Math.max(emptyExtras, extra) }, (_, k) => photoSlotHtml(g.key, '', urls.length + k, total)))
        .join('');
      box.innerHTML = rows;
    });
    renderPhotosPreview();
  }

  function addPhotoSlot(groupKey) {
    const g = PHOTO_GROUPS.find(x => x.key === groupKey);
    if (!g) return;
    syncPhotoStateFromDom(groupKey); // conserva i link già digitati
    const list = photoState[groupKey];
    const hardCap = 12;
    if (list.length >= hardCap) { toast(`Massimo ${hardCap} foto per questa sezione.`, true); return; }
    // Ogni click crea SEMPRE una riga nuova (vuota), senza toccare le altre
    list.push('');
    photoExtraSlots[groupKey] = (photoExtraSlots[groupKey] || 0) + 1;
    currentPhotos[groupKey] = list.map(validPhotoUrl).filter(Boolean);
    renderPhotoSlots();
    const inputs = $$('.photo-url-input[data-group="' + groupKey + '"]');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }

  function removePhotoSlot(groupKey, idx) {
    syncPhotoStateFromDom(groupKey);
    const list = photoState[groupKey];
    const filledCount = list.filter(Boolean).length;
    if (groupKey !== 'studio' && filledCount <= 1 && list.length <= 1) { toast('Lascia almeno una foto in questa sezione.', true); return; }
    list.splice(idx, 1);
    photoExtraSlots[groupKey] = Math.max(0, (photoExtraSlots[groupKey] || 0) - 1);
    currentPhotos[groupKey] = list.map(validPhotoUrl).filter(Boolean);
    renderPhotoSlots();
  }

  function collectPhotoInputs() {
    // Raccoglie gli input correnti nei gruppi (senza ri-renderizzare) e
    // allinea anche lo stato "veritiero" photoState
    PHOTO_GROUPS.forEach(g => {
      const inputs = $$('.photo-url-input').filter(i => i.dataset.group === g.key);
      const vals = inputs.map(i => String(i.value || '').trim());
      if (vals.length) photoState[g.key] = vals;
      currentPhotos[g.key] = (photoState[g.key] || []).map(validPhotoUrl).filter(Boolean);
    });
  }

  async function loadPhotos() {
    setBusy(true);
    try {
      const snap = await FB.getDoc(FB.doc(FB.db, PHOTOS_COL, PHOTOS_DOC));
      const d = snap && snap.exists() ? (snap.data() || {}) : {};
      // Se nel database non c'è ancora nulla (o un gruppo è vuoto) mostriamo
      // le foto predefinite del sito: la dashboard rispecchia sempre ciò che
      // i visitatori vedono davvero in Home, invece di partire da slot vuoti.
      ['hero', 'about', 'studio'].forEach(k => {
        const saved = Array.isArray(d[k]) ? d[k].map(validPhotoUrl).filter(Boolean) : [];
        const list = saved.length ? saved : [...(PHOTOS_DEFAULTS[k] || [])];
        currentPhotos[k] = [...list];
        photoState[k] = [...list];
      });
    } catch (err) {
      console.warn('Foto non caricate (uso default):', err);
    } finally { setBusy(false); }
    renderPhotoSlots();
  }
  function photoHasDraft(gKey) {
    const box = $(PHOTO_GROUPS.find(g => g.key === gKey)?.slots || '#none');
    if (!box) return false;
    return Array.from(box.querySelectorAll('.photo-url-input')).some(i => String(i.value || '').trim());
  }

  async function savePhotos(keys) {
    collectPhotoInputs();
    const targets = Array.isArray(keys) && keys.length ? keys : ['hero', 'about', 'studio'];
    // Rimuove URL vuoti intermedi (sia nello stato che nelle liste salvate)
    targets.forEach(k => {
      photoState[k] = (photoState[k] || []).filter(Boolean);
      currentPhotos[k] = (currentPhotos[k] || []).filter(Boolean);
    });
    if (targets.includes('hero') && !currentPhotos.hero.length) { currentPhotos.hero = [...PHOTOS_DEFAULTS.hero]; photoState.hero = [...PHOTOS_DEFAULTS.hero]; }
    if (targets.includes('about') && !currentPhotos.about.length) { currentPhotos.about = [...PHOTOS_DEFAULTS.about]; photoState.about = [...PHOTOS_DEFAULTS.about]; }
    setBusy(true);
    try {
      await FB.setDoc(FB.doc(FB.db, PHOTOS_COL, PHOTOS_DOC), {
        hero: currentPhotos.hero,
        about: currentPhotos.about,
        studio: currentPhotos.studio,
        updatedAt: new Date().toISOString()
      });
      // Al salvataggio gli slot extra "consumati" diventano foto vere
      targets.forEach(k => { photoExtraSlots[k] = 0; });
      renderPhotoSlots();
      toast(targets.length === 1
        ? `Foto "${PHOTO_GROUPS.find(g => g.key === targets[0]).label.split('—')[0].trim()}" salvate: la Home si aggiorna subito.`
        : 'Foto salvate: la Home le mostra al prossimo caricamento.');
    } catch (err) {
      console.error(err);
      toast(permHint(err, 'foto'), true);
    } finally { setBusy(false); }
  }

  function resetPhotos() {
    confirmAction('Ripristinare le foto originali?', 'Le foto personalizzate verranno eliminate dal database e la Home tornerà alle immagini predefinite.')
      .then(async (yes) => {
        if (!yes) return;
        setBusy(true);
        try {
          await FB.deleteDoc(FB.doc(FB.db, PHOTOS_COL, PHOTOS_DOC)).catch(() => {});
          currentPhotos = JSON.parse(JSON.stringify(PHOTOS_DEFAULTS));
          ['hero', 'about', 'studio'].forEach(k => { photoState[k] = [...(currentPhotos[k] || [])]; photoExtraSlots[k] = 0; });
          renderPhotoSlots();
          toast('Foto originali ripristinate.');
        } catch (err) { console.error(err); toast('Errore: ' + err.message, true); }
        finally { setBusy(false); }
      });
  }

  /* ---- Anteprima live delle foto: replica gli riquadri reali della Home ---- */
  function pvFrameHtml(label, urls, ratioCss, badgeClass) {
    const first = (urls || []).filter(Boolean)[0] || '';
    return `
      <div style="margin-bottom:14px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#6b6557;margin-bottom:6px;">${label}</div>
        <div class="${badgeClass}" style="position:relative;border-radius:16px;overflow:hidden;border:1px solid #ddd6c6;${ratioCss};max-width:190px;background:#efe9dd;">
          ${first
            ? `<img src="${esc(first)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" onerror="this.remove()" />`
            : '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#b3ab97;"><i class="fa-regular fa-image" style="font-size:22px;"></i></div>'}
          ${(urls || []).filter(Boolean).length > 1 ? '<span style="position:absolute;top:8px;right:8px;background:rgba(33,33,33,.65);color:#fff;font-size:10px;padding:2px 7px;border-radius:999px;">ruota ogni 4s</span>' : ''}
        </div>
        ${(urls || []).filter(Boolean).length > 1 ? `<div style="display:flex;gap:6px;margin-top:6px;">${urls.filter(Boolean).map((u, i) => `<img src="${esc(u)}" alt="" title="Foto ${i + 1}" style="width:34px;height:34px;object-fit:cover;border-radius:8px;border:1px solid #ddd6c6;" onerror="this.style.display='none'" />`).join('')}</div>` : ''}
      </div>`;
  }

  function renderPhotosPreview() {
    const box = $('#pv-photos');
    if (!box) return;
    // Se sto scrivendo in uno slot, l'anteprima segue la digitazione in diretta
    const draftHero = ($$('.photo-url-input').find(i => i.dataset.group === 'hero') || {}).value;
    const heroList = (draftHero !== undefined && document.activeElement && document.activeElement.classList.contains('photo-url-input'))
      ? (() => { collectPhotoInputs(); return currentPhotos.hero; })()
      : currentPhotos.hero;
    const aboutList = (document.activeElement && document.activeElement.classList.contains('photo-url-input') && document.activeElement.dataset.group === 'about')
      ? (() => { collectPhotoInputs(); return currentPhotos.about; })()
      : currentPhotos.about;
    const studioList = (document.activeElement && document.activeElement.classList.contains('photo-url-input') && document.activeElement.dataset.group === 'studio')
      ? (() => { collectPhotoInputs(); return currentPhotos.studio; })()
      : currentPhotos.studio;
    box.innerHTML =
      pvFrameHtml('Dove: Hero — dietro la targhetta «Valeria Moretti · Mental Coach»', heroList, 'aspect-ratio:4/5;', 'pv-photo-hero') +
      pvFrameHtml('Dove: sezione «Chi sono — Ciao, sono Valeria»', aboutList, 'aspect-ratio:3/4;', 'pv-photo-about') +
      pvFrameHtml('Dove: sezione «Il mio Studio»', studioList, 'aspect-ratio:16/10;', 'pv-photo-studio');
  }

  function initPhotosSection() {
    // Delega eventi sugli slot (input, focus, rimozione)
    ['#hero-slots', '#about-slots', '#studio-slots'].forEach(sel => {
      const box = $(sel);
      if (!box) return;
      box.addEventListener('input', (e) => {
        if (e.target.classList.contains('photo-url-input')) {
          const g = e.target.dataset.group;
          const url = validPhotoUrl(e.target.value);
          const thumb = e.target.closest('.photo-slot')?.querySelector('.photo-thumb img');
          if (thumb) {
            if (url) { thumb.src = url; thumb.style.display = ''; }
            else { thumb.style.opacity = '.35'; }
          }
          renderPhotosPreview();
        }
      });
      box.addEventListener('click', (e) => {
        const rm = e.target.closest('.photo-remove-btn');
        if (rm) removePhotoSlot(rm.dataset.group, Number(rm.dataset.idx));
      });
    });
    const bh = $('#btn-hero-add'); if (bh) bh.addEventListener('click', () => addPhotoSlot('hero'));
    const ba = $('#btn-about-add'); if (ba) ba.addEventListener('click', () => addPhotoSlot('about'));
    const bst = $('#btn-studio-add'); if (bst) bst.addEventListener('click', () => addPhotoSlot('studio'));
    const bhs = $('#btn-hero-save'); if (bhs) bhs.addEventListener('click', () => savePhotos(['hero']));
    const bas = $('#btn-about-save'); if (bas) bas.addEventListener('click', () => savePhotos(['about']));
    const bss = $('#btn-studio-save'); if (bss) bss.addEventListener('click', () => savePhotos(['studio']));
    const bs = $('#btn-photos-save'); if (bs) bs.addEventListener('click', () => savePhotos());
    const br = $('#btn-photos-reset'); if (br) br.addEventListener('click', resetPhotos);
    loadPhotos();
    // Live-sync: se l'admin ha due tab aperte, le foto si aggiornano da sole
    try {
      if (FB.onSnapshot) {
        FB.onSnapshot(FB.doc(FB.db, PHOTOS_COL, PHOTOS_DOC), (snap) => {
          if (!snap.exists()) return;
          if (document.activeElement && document.activeElement.classList.contains('photo-url-input')) return;
          const d = snap.data() || {};
          ['hero', 'about', 'studio'].forEach(k => {
            if (Array.isArray(d[k]) && !photoHasDraft(k) && !(photoExtraSlots[k] > 0)) {
              currentPhotos[k] = d[k].map(validPhotoUrl).filter(Boolean);
              photoState[k] = [...currentPhotos[k]];
            }
          });
          renderPhotoSlots();
        });
      }
    } catch (e) { console.warn('onSnapshot foto non attivo:', e); }
  }

  /* ============ SEZIONE: AGGIORNAMENTO SOCIAL ==============
     I link di Instagram, TikTok, YouTube, Telegram, WhatsApp, telefono ed
     email sono salvati in Firestore (collection 'site_social', doc 'links').
     script.js della Home li legge e aggiorna footer, popup «Scegli la
     modalità» e pulsanti social del sito pubblico. */
  const SOCIAL_COL = 'site_social';
  const SOCIAL_DOC = 'links';

  const SOCIAL_DEFAULTS = {
    instagram: 'https://www.instagram.com/mentalcoachvaleria95',
    tiktok:    'https://www.tiktok.com/@mentalcoachvaleria95',
    youtube:   'https://www.youtube.com/@mentalcoachvaleria95',
    telegram:  'https://t.me/mentalcoachvaleria95',
    whatsapp:  'https://wa.me/393458407102',
    phone:     '+393458407102',
    email:     'mentalcoachvaleria@gmail.com',
    fb_pixel_id: ''
  };

  const SOCIAL_META = [
    { key: 'instagram', label: 'Instagram', icon: 'fa-brands fa-instagram', bg: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)' },
    { key: 'tiktok',    label: 'TikTok',    icon: 'fa-brands fa-tiktok',    bg: '#010101' },
    { key: 'youtube',   label: 'YouTube',   icon: 'fa-brands fa-youtube',   bg: '#ff0000' },
    { key: 'telegram',  label: 'Telegram',  icon: 'fa-brands fa-telegram',  bg: '#229ED9' },
    { key: 'whatsapp',  label: 'WhatsApp',  icon: 'fa-brands fa-whatsapp',  bg: '#25D366' },
    { key: 'phone',     label: 'Telefono',  icon: 'fa-solid fa-phone',      bg: '#2f4f3e' },
    { key: 'email',     label: 'Email',     icon: 'fa-solid fa-envelope',   bg: '#ea4335' },
    { key: 'fb_pixel_id', label: 'Facebook Pixel', icon: 'fa-brands fa-facebook', bg: '#1877F2' }
  ];

  let currentSocial = Object.assign({}, SOCIAL_DEFAULTS);

  function validSocialValue(key, v) {
    v = String(v || '').trim();
    if (!v) return '';
    if (key === 'email') return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? v : '';
    if (key === 'phone') {
      const digits = v.replace(/[^\d+]/g, '');
      return /^(\+?\d{6,15})$/.test(digits) ? digits : '';
    }
    if (key === 'fb_pixel_id') {
      const digits = v.replace(/\D/g, '');
      return /^\d{6,20}$/.test(digits) ? digits : '';
    }
    return /^https?:\/\/.+\..+/i.test(v) ? v : '';
  }

  function socialHrefFor(key, val) {
    if (!val) return '#';
    if (key === 'email') return 'mailto:' + val;
    if (key === 'phone') return 'tel:' + val;
    if (key === 'fb_pixel_id') return '#';
    return val;
  }

  function renderSocialFields() {
    SOCIAL_META.forEach(m => {
      const inp = $(`.social-url-input[data-key="${m.key}"]`);
      if (inp && document.activeElement !== inp) inp.value = currentSocial[m.key] || '';
    });
    // Stato bottone "Rimuovi pixel": attivo solo se un pixel è salvato nel database
    const prBtn = $('#pixel-remove-btn');
    if (prBtn) prBtn.disabled = !currentSocial.fb_pixel_id;
    renderSocialPreview();
  }

  // Rimuovi Facebook Pixel: cancella l'ID dal campo, dal database e disattiva
  // l'iniezione del codice Pixel sul sito pubblico (config/site_config -> general.pixelId = '').
  async function removePixel() {
    const st = $('#social-status');
    if (!currentSocial.fb_pixel_id) {
      const inp = $('.social-url-input[data-key="fb_pixel_id"]');
      if (inp) inp.value = '';
      if (st) { st.textContent = 'Nessun pixel salvato da rimuovere.'; st.style.color = '#98917f'; }
      return;
    }
    const yes = await new Promise(function(resolve) { confirmAction('Rimuovere il Facebook Pixel?', 'Il codice del Pixel verrà rimosso dal sito pubblico e smetterà di tracciare visite ed eventi. Potrai reinserire l\'ID in qualsiasi momento.')
      .then(function(v){ resolve(!!v); }, function(){ resolve(false); }); });
    if (!yes) return;
    setBusy(true);
    try {
      const inp = $('.social-url-input[data-key="fb_pixel_id"]');
      if (inp) inp.value = '';
      delete currentSocial.fb_pixel_id;
      await FB.setDoc(FB.doc(FB.db, SOCIAL_COL, SOCIAL_DOC), { fb_pixel_id: '' }, { merge: true });
      await FB.setDoc(FB.doc(FB.db, 'config', 'site_config'), { general: { pixelId: '' } }, { merge: true }).catch(function(pErr){ console.warn('Config pixel non aggiornata:', pErr); });
      renderSocialFields();
      if (st) { st.textContent = '✔ Facebook Pixel rimosso: il sito ha smesso di tracciare.'; st.style.color = '#2e7d5b'; }
      toast('Facebook Pixel rimosso.');
    } catch (err) {
      console.error(err);
      if (st) { st.textContent = '✖ ' + permHint(err, 'social'); st.style.color = '#c0392b'; }
      toast(permHint(err, 'social'), true);
    } finally { setBusy(false); }
  }

  async function loadSocial() {
    try {
      const snap = await FB.getDoc(FB.doc(FB.db, SOCIAL_COL, SOCIAL_DOC));
      if (snap.exists()) {
        const d = snap.data() || {};
        SOCIAL_META.forEach(m => {
          const v = validSocialValue(m.key, d[m.key]);
          if (v) currentSocial[m.key] = v;
        });
      }
    } catch (err) {
      console.warn('Social non caricati (uso default):', err);
    }
    renderSocialFields();
  }

  async function saveSocial() {
    const next = {};
    let anyValid = false;
    SOCIAL_META.forEach(m => {
      const inp = $(`.social-url-input[data-key="${m.key}"]`);
      const v = validSocialValue(m.key, inp ? inp.value : '');
      if (v) { next[m.key] = v; anyValid = true; }
    });
    if (!anyValid) { toast('Inserisci almeno un link valido prima di salvare.', true); return; }
    setBusy(true);
    try {
      await FB.setDoc(FB.doc(FB.db, SOCIAL_COL, SOCIAL_DOC), Object.assign(next, { updatedAt: new Date().toISOString() }), { merge: true });
      // Facebook Pixel: salvato anche in config/site_config (general.pixelId),
      // così script.js della Home lo legge e inietta il codice del Pixel nell'HTML.
      try {
        const pixelVal = next.fb_pixel_id || '';
        await FB.setDoc(FB.doc(FB.db, 'config', 'site_config'), { general: { pixelId: pixelVal } }, { merge: true });
      } catch (pErr) { console.warn('Pixel non salvato in config:', pErr); }
      Object.assign(currentSocial, next);
      renderSocialFields();
      const st = $('#social-status');
      if (st) { st.textContent = '✔ Social salvati: footer, popup e contatti della Home si aggiornano subito.'; st.style.color = '#2e7d5b'; }
      toast('Link social salvati.');
    } catch (err) {
      console.error(err);
      const st = $('#social-status');
      if (st) { st.textContent = '✖ ' + permHint(err, 'social'); st.style.color = '#c0392b'; }
      toast(permHint(err, 'social'), true);
    } finally { setBusy(false); }
  }

  function resetSocial() {
    confirmAction('Ripristinare i link social originali?', 'I link personalizzati verranno eliminati dal database e il sito tornerà ai canali predefiniti.')
      .then(async (yes) => {
        if (!yes) return;
        setBusy(true);
        try {
          await FB.deleteDoc(FB.doc(FB.db, SOCIAL_COL, SOCIAL_DOC)).catch(() => {});
          currentSocial = Object.assign({}, SOCIAL_DEFAULTS);
          renderSocialFields();
          const st = $('#social-status');
          if (st) { st.textContent = 'Link originali ripristinati.'; st.style.color = '#2e7d5b'; }
          toast('Social ripristinati.');
        } catch (err) { console.error(err); toast('Errore: ' + err.message, true); }
        finally { setBusy(false); }
      });
  }

  function renderSocialPreview() {
    const box = $('#pv-social');
    if (!box) return;
    // Segue la digitazione in diretta
    const live = {};
    SOCIAL_META.forEach(m => {
      const inp = $(`.social-url-input[data-key="${m.key}"]`);
      live[m.key] = validSocialValue(m.key, inp ? inp.value : '') || currentSocial[m.key] || '';
    });
    box.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${SOCIAL_META.filter(m => m.key !== 'fb_pixel_id').map(m => `
          <a href="${esc(socialHrefFor(m.key, live[m.key]))}" target="_blank" rel="noopener noreferrer" title="${esc(live[m.key] || 'Non impostato')}"
             style="display:inline-flex;align-items:center;gap:7px;background:#fff;border:1px solid #ddd6c6;border-radius:999px;padding:6px 12px 6px 6px;text-decoration:none;color:#2f4f3e;font-size:11.5px;font-weight:600;transition:transform .2s ease;"
             onmouseover="this.style.transform='scale(1.06)'" onmouseout="this.style.transform=''">
            <span style="width:24px;height:24px;border-radius:50%;background:${m.bg};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;"><i class="${m.icon}"></i></span>
            ${m.label}
          </a>`).join('')}
      </div>
      <p style="font-size:10.5px;color:#98917f;margin-top:8px;">Anteprima dei collegamenti reali: cliccabili come nella Home.</p>`;
  }

  function initSocialSection() {
    const wrap = $('#social-fields');
    if (wrap) {
      wrap.addEventListener('input', (e) => {
        if (e.target.classList.contains('social-url-input')) renderSocialPreview();
      });
    }
    const bs = $('#btn-social-save'); if (bs) bs.addEventListener('click', saveSocial);
    const br = $('#btn-social-reset'); if (br) br.addEventListener('click', resetSocial);
    const prm = $('#pixel-remove-btn'); if (prm) prm.addEventListener('click', removePixel);
    loadSocial();
    try {
      if (FB.onSnapshot) {
        FB.onSnapshot(FB.doc(FB.db, SOCIAL_COL, SOCIAL_DOC), (snap) => {
          if (!snap.exists()) return;
          if (document.activeElement && document.activeElement.classList.contains('social-url-input')) return;
          const d = snap.data() || {};
          SOCIAL_META.forEach(m => {
            const v = validSocialValue(m.key, d[m.key]);
            if (v) currentSocial[m.key] = v;
            else if (m.key === 'fb_pixel_id') delete currentSocial.fb_pixel_id; // pixel rimosso -> bottone si disattiva
          });
          renderSocialFields();
        });
      }
    } catch (e) { console.warn('onSnapshot social non attivo:', e); }
  }


  // Wrapper: ogni rendering locale aggiorna automaticamente anche l'anteprima live a destra.
  function renderReviewsTableAndPreview() { renderReviewsTable(); renderLivePreview(); }
  function renderQuestionsListAndPreview() { renderQuestionsList(); renderLivePreview(); }
  function renderPackagesAndPreview() { renderPackages(); renderLivePreview(); }

  /* ============ ANTEPRIMA MENTRE SCRIVI (draft live) ==============
     Ogni volta che l'amministratrice digita in un form (nome recensione,
     testo domanda, nome pacchetto...), la colonna di destra mostra
     immediatamente l'elemento così come sta nascendo, evidenziato con
     il bordo tratteggiato "bozza". La funzione è debounce 120ms per
     restare fluida anche su digitazione veloce.                      */
  const DRAFT_Q_IDS     = ['#q-text'];
  const DRAFT_PKG_IDS   = ['#pkg-name', '#pkg-price', '#pkg-tag'];
  const DRAFT_FAQ_IDS   = ['#faq-q', '#faq-a'];

  function draftQuestionHtml() {
    const text = ($('#q-text').value || '').trim();
    if (!text) return '';
    const opts = $$('#options-editor .opt-row')
      .map(r => ({ text: r.querySelector('[data-opt-text]').value.trim() }))
      .filter(o => o.text);
    const nextNum = sortedQuestions().length + 1;
    return `
      <div class="pvq-modal pvq-draft">
        <div class="pvq-qnum">Domanda ${nextNum} — bozza</div>
        <div class="pvq-qtext">${esc(text)}</div>
        ${opts.length ? opts.map(o => `
          <div class="pvq-answer"><span>${esc(o.text)}</span></div>`).join('')
          : '<div style="font-size:11px;color:#98917f;">Ancora nessuna risposta</div>'}
      </div>`;
  }

  function draftPackageHtml() {
    const name  = ($('#pkg-name').value || '').trim();
    const price = ($('#pkg-price').value || '').trim();
    const feats = featureTexts();
    if (!name && !price) return '';
    // Stile identico alla card servizio della Home (vedi pvServiceCardHtml)
    const featured = /piano|completo/i.test(name);
    const btnLabel = featured ? 'Acquista il piano' : (/online/i.test(name) ? 'Prenota online' : /gruppo/i.test(name) ? "Lista d'interesse" : 'Prenota in studio');
    return `
      <div class="pv-service-card pv-draft${featured ? ' featured' : ''}">
        ${featured ? '<span class="pv-service-tag">Il più completo</span>' : ''}
        <h3><span class="pv-title-icon">${pkgIconSvg($('#pkg-icon-key') && $('#pkg-icon-key').value)}</span> ${esc(name) || '<em style="opacity:.6;">Nome pacchetto…</em>'}</h3>
        ${price ? `<div class="pv-service-price">${esc(price)}</div>` : ''}
        ${feats.length ? `<ul>${feats.slice(0, 5).map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : `<p class="pv-pdesc" style="margin-top:6px;"><em style="opacity:.6;">Aggiungi i punti elenco del pacchetto…</em></p>`}
        <span class="pv-hbtn ${featured ? 'pv-hbtn--forest' : 'pv-hbtn--sage'}">${btnLabel}</span>
      </div>`;
  }

  function draftFaqHtml() {
    const q = ($('#faq-q') && $('#faq-q').value || '').trim();
    const a = ($('#faq-a') && $('#faq-a').value || '').trim();
    if (!q && !a) return '';
    const num = faqEditId
      ? String(sortedFaqs().findIndex(f => f.id === faqEditId) + 1).padStart(2, '0')
      : String(sortedFaqs().filter(f => f.active !== false).length + 1).padStart(2, '0');
    return `
      <div class="pv-draft" style="padding:10px 12px;border-radius:10px;background:#fff;border:1.5px dashed #c6d6ca;">
        <span style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#b45309;">bozza FAQ — sezione «Le risposte che cercavi»</span>
        <div style="display:flex;gap:8px;align-items:flex-start;margin-top:6px;">
          <span style="flex-shrink:0;display:grid;place-items:center;width:28px;height:28px;border-radius:8px;background:#e3ebe5;color:#2f4f3e;font-weight:700;font-size:11px;">${num}</span>
          <strong style="font-size:12.5px;color:#315b55;">${esc(q) || '<em style="color:#98917f;">La domanda comparirà qui…</em>'}</strong>
        </div>
        ${a ? `<p style="font-size:11.5px;color:#5b6a66;margin:6px 0 0;line-height:1.55;white-space:pre-line;">${esc(a)}</p>` : ''}
      </div>`;
  }

  function renderDrafts() {
    const d2 = $('#pv-draft-question'); if (d2) d2.innerHTML = draftQuestionHtml();
    const d3 = $('#pv-draft-package');  if (d3) d3.innerHTML = draftPackageHtml();
    const d5 = $('#pv-draft-faq');      if (d5) d5.innerHTML = draftFaqHtml();
    // La miniatura della Home segue la bozza del pacchetto mentre si scrive
    renderMiniHome();
  }

  // Svuota gli slot "bozza" (usato dopo un salvataggio: il dato reale entra nelle liste).
  function renderDraftsCleared() {
    ['#pv-draft-question', '#pv-draft-package', '#pv-draft-faq']
      .forEach(sel => { const el = $(sel); if (el) el.innerHTML = ''; });
  }

  let draftTimer = null;
  function scheduleDraftRender() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(renderDrafts, 120);
  }

  function initDraftLivePreview() {
    [...DRAFT_Q_IDS, ...DRAFT_PKG_IDS, ...DRAFT_FAQ_IDS].forEach(sel => {
      const el = $(sel);
      if (!el) return;
      el.addEventListener('input', scheduleDraftRender);
      el.addEventListener('change', renderDrafts); // select/checkbox reagiscono subito
    });
    // Le opzioni di risposta della domanda cambiano dinamicamente: intercetta gli input dentro l'editor
    const optEd = $('#options-editor');
    if (optEd) {
      optEd.addEventListener('input', scheduleDraftRender);
      optEd.addEventListener('click', scheduleDraftRender); // aggiunta/rimozione righe
    }
    // I punti elenco del pacchetto cambiano dinamicamente come le risposte
    const featEd = $('#features-editor');
    if (featEd) {
      featEd.addEventListener('input', scheduleDraftRender);
      featEd.addEventListener('click', scheduleDraftRender); // aggiunta/rimozione righe
    }
    // Stelle: aggiornate già via change, ma assicuriamoci all'apertura del pannello recensioni
    const starWrap = $('#rev-star-rating');
    if (starWrap) starWrap.addEventListener('change', renderDrafts);
    renderDrafts();
  }

  /* =================== COLORI & STILE (tema sito) ==================
     Il tema è salvato in Firestore (collection 'site_settings', doc
     'theme') e viene applicato alla Home da script.js tramite variabili
     CSS. Qui l'admin lo modifica con un color picker per ogni voce.   */
  const THEME_COL = 'site_settings';
  const THEME_DOC = 'theme';

  /* Default = colori reali di style.css della Home, così l'anteprima live
     a destra parte identica al sito pubblico. */
  const THEME_DEFAULTS = {
    pageBg: '#F8F5EF', pageText: '#2e3734',
    heroBg: '#F8F5EF', heroText: '#2e3734',
    problemsBg: '#F8F5EF', problemsText: '#2e3734',
    methodBg: '#E3EBE5', methodText: '#2e3734',
    servicesBg: '#F8F5EF', servicesText: '#2e3734',
    cardBg: '#ffffff', cardText: '#2e3734',
    featCardBg: '#315B55', featCardText: '#F8F5EF',
    testimonialsBg: '#E3EBE5', testimonialsText: '#2e3734',
    faqBg: '#F8F5EF', faqText: '#2e3734',
    studioBg: '#F8F5EF', studioText: '#2e3734',
    footerBg: '#22272b', footerText: '#dfe4dd',
    btnPrimaryBg: '#315B55', btnPrimaryText: '#F8F5EF',
    btnSecondaryBg: '#F8F5EF', btnSecondaryText: '#212121',
    btnSageBg: '#C6D6CA', btnSageText: '#212121',
    btnNavBg: '#315B55', btnNavText: '#F8F5EF'
  };

  const THEME_SECTIONS = [
    { group: 'Sfondo e testo generale del sito' },
    { key: 'pageBg', label: 'Sfondo generale (base del sito)' },
    { key: 'pageText', label: 'Testo generale (base del sito)' },
    { group: 'Sezione Hero (inizio Home)' },
    { key: 'heroBg', label: 'Sfondo sezione Hero' },
    { key: 'heroText', label: 'Testo sezione Hero' },
    { group: 'Sezione "I blocchi più comuni"' },
    { key: 'problemsBg', label: 'Sfondo sezione Blocchi' },
    { key: 'problemsText', label: 'Testo sezione Blocchi' },
    { group: 'Sezione Metodo P.E.R.S.M.A.R.T.' },
    { key: 'methodBg', label: 'Sfondo sezione Metodo' },
    { key: 'methodText', label: 'Testo sezione Metodo' },
    { group: 'Sezione Servizi' },
    { key: 'servicesBg', label: 'Sfondo sezione Servizi' },
    { key: 'servicesText', label: 'Testo sezione Servizi' },
    { group: 'Card pacchetto normale (bianca)' },
    { key: 'cardBg', label: 'Sfondo card pacchetto' },
    { key: 'cardText', label: 'Testo card pacchetto' },
    { group: 'Card pacchetto in evidenza ("Il più completo")' },
    { key: 'featCardBg', label: 'Sfondo card in evidenza' },
    { key: 'featCardText', label: 'Testo card in evidenza' },
    { group: 'Sezione Recensioni' },
    { key: 'testimonialsBg', label: 'Sfondo sezione Recensioni' },
    { key: 'testimonialsText', label: 'Testo sezione Recensioni' },
    { group: 'Sezione FAQ' },
    { key: 'faqBg', label: 'Sfondo sezione FAQ' },
    { key: 'faqText', label: 'Testo sezione FAQ' },
    { group: 'Sezione "Il mio Studio"' },
    { key: 'studioBg', label: 'Sfondo sezione Studio' },
    { key: 'studioText', label: 'Testo sezione Studio' },
    { group: 'Footer' },
    { key: 'footerBg', label: 'Sfondo footer' },
    { key: 'footerText', label: 'Testo footer' }
  ];

  const THEME_BUTTONS = [
    { group: 'Bottoni verdi scuri (CTA "Prenota una sessione", "Acquista il piano", invio moduli…)' },
    { key: 'btnPrimaryBg', label: 'Background — bottoni primari' },
    { key: 'btnPrimaryText', label: 'Testo — bottoni primari' },
    { group: 'Bottoni chiari ("Fai il test gratuito", "Inizia il test")' },
    { key: 'btnSecondaryBg', label: 'Background — bottoni chiari' },
    { key: 'btnSecondaryText', label: 'Testo — bottoni chiari' },
    { group: 'Bottoni salvia sulle card ("Prenota in studio", "Prenota online", "Lista d\'interesse")' },
    { key: 'btnSageBg', label: 'Background — bottoni salvia' },
    { key: 'btnSageText', label: 'Testo — bottoni salvia' },
    { group: 'Bottone "Prenota" nella navbar + CTA menu mobile' },
    { key: 'btnNavBg', label: 'Background — bottone navbar' },
    { key: 'btnNavText', label: 'Testo — bottone navbar' }
  ];

  let currentTheme = { ...THEME_DEFAULTS };

  function hexToCss(v, fallback) {
    return /^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? v : (fallback || '#000000');
  }

  function buildColorRows(containerSel, defs) {
    const box = $(containerSel);
    if (!box) return;
    // Se gli input esistono già, NON ricostruire nulla: aggiorniamo solo i
    // valori. Ricostruire il DOM (innerHTML) durante l'interazione causava la
    // perdita del colore appena scelto e rendeva "muti" campione + campo hex.
    const existing = box.querySelector('input[type="color"][data-tkey]');
    if (existing) {
      defs.filter(d => !d.group).forEach(d => {
        const val = hexToCss(currentTheme[d.key], THEME_DEFAULTS[d.key]);
        const picker = $('#tc-' + d.key);
        if (picker && picker !== document.activeElement) picker.value = val;
        const hv = $('#hv-' + d.key);
        if (hv && hv !== document.activeElement) hv.value = val;
      });
      return;
    }
    /* Ogni voce "group" apre una CARD (una sezione del sito) che contiene le
       righe colore successive. Così "Colori & stile" si legge come un elenco
       ordinato di sezioni e non come una griglia di campioni sparsi. */
    let html = '';
    let open = false;
    defs.forEach(d => {
      if (d.group) {
        if (open) html += '</div>';
        html += `<div class="color-group"><div class="color-group-title">${esc(d.group)}</div>`;
        open = true;
        return;
      }
      if (!open) { html += '<div class="color-group">'; open = true; }
      const val = hexToCss(currentTheme[d.key], THEME_DEFAULTS[d.key]);
      html += `<div class="color-row">
           <label class="cl" for="tc-${d.key}">${esc(d.label)}</label>
           <input type="color" id="tc-${d.key}" data-tkey="${d.key}" value="${val}" title="Clicca per scegliere un colore" />
           <input type="text" class="hexv" id="hv-${d.key}" data-thex="${d.key}" maxlength="7" spellcheck="false" autocomplete="off" value="${val}" title="Oppure scrivi il codice esadecimale (es. #315B55)" />
         </div>`;
    });
    if (open) html += '</div>';
    box.innerHTML = html;
  }

  /* Cambio dal campione colore: aggiorna tema, campo hex gemello e anteprima. */
  function onThemePickerChange(e) {
    const inp = e.target.closest('input[type="color"][data-tkey]');
    if (!inp) return;
    const k = inp.dataset.tkey;
    currentTheme[k] = inp.value.toUpperCase();
    const hv = $('#hv-' + k);
    if (hv) hv.value = currentTheme[k];
    applyPreviewTheme(currentTheme);
  }

  /* Il campo esadecimale accetta "#RGB" o "#RRGGBB"; se valido aggiorna
     campione + tema + anteprima, altrimenti riporta l'ultimo valore buono. */
  function onThemeHexChange(e) {
    const inp = e.target.closest('input.hexv[data-thex]');
    if (!inp) return;
    const k = inp.dataset.thex;
    let val = String(inp.value || '').trim();
    if (val && val[0] !== '#') val = '#' + val;
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val)) {
      if (val.length === 4) val = '#' + [...val.slice(1)].map(c => c + c).join('');
      val = val.toUpperCase();
      currentTheme[k] = val;
      const picker = $('#tc-' + k);
      if (picker) picker.value = val;
      inp.value = val;
      applyPreviewTheme(currentTheme);
    } else {
      inp.value = hexToCss(currentTheme[k], THEME_DEFAULTS[k]);
    }
  }

  /* L'anteprima live replica esattamente le regole CSS della Home
     (.service-card / .featured / .btn--uiverse di style.css), traslandole
     su .pv-* e rendendo i colori pilotati dalle variabili --pv-*. */
  function applyPreviewTheme(t) {
    const pane = $('#preview-pane');
    if (!pane) return;
    const v = (k, fb) => hexToCss(t[k], fb || THEME_DEFAULTS[k]);
    // Variabili per card normali / in evidenza / recensioni / sezioni anteprima
    pane.style.setProperty('--pv-page-bg', v('pageBg'));
    pane.style.setProperty('--pv-page-txt', v('pageText'));
    pane.style.setProperty('--pv-hero-bg', v('heroBg'));
    pane.style.setProperty('--pv-hero-txt', v('heroText'));
    pane.style.setProperty('--pv-method-bg', v('methodBg'));
    pane.style.setProperty('--pv-method-txt', v('methodText'));
    pane.style.setProperty('--pv-services-bg', v('servicesBg'));
    pane.style.setProperty('--pv-services-txt', v('servicesText'));
    pane.style.setProperty('--pv-testi-bg', v('testimonialsBg'));
    pane.style.setProperty('--pv-testi-txt', v('testimonialsText'));
    pane.style.setProperty('--pv-faq-bg', v('faqBg'));
    pane.style.setProperty('--pv-faq-txt', v('faqText'));
    pane.style.setProperty('--pv-studio-bg', v('studioBg'));
    pane.style.setProperty('--pv-studio-txt', v('studioText'));
    pane.style.setProperty('--pv-footer-bg', v('footerBg'));
    pane.style.setProperty('--pv-footer-txt', v('footerText'));
    pane.style.setProperty('--pv-card-bg', v('cardBg'));
    pane.style.setProperty('--pv-card-txt', v('cardText'));
    pane.style.setProperty('--pv-feat-bg', v('featCardBg'));
    pane.style.setProperty('--pv-feat-txt', v('featCardText'));
    pane.style.setProperty('--pv-btn1-bg', v('btnPrimaryBg'));
    pane.style.setProperty('--pv-btn1-txt', v('btnPrimaryText'));
    pane.style.setProperty('--pv-btn2-bg', v('btnSecondaryBg'));
    pane.style.setProperty('--pv-btn2-txt', v('btnSecondaryText'));
    pane.style.setProperty('--pv-sage-bg', v('btnSageBg'));
    pane.style.setProperty('--pv-sage-txt', v('btnSageText'));
    pane.style.setProperty('--pv-nav-bg', v('btnNavBg'));
    pane.style.setProperty('--pv-nav-txt', v('btnNavText'));
    renderMiniHome();
  }

  /* ---- Miniatura fedele della Home: hero + card pacchetto reale ---- */
  function pvServiceCardHtml(p, featured) {
    const icons = { 'sessione': 'fa-user', 'online': 'fa-laptop', 'gruppo': 'fa-users', 'piano': 'fa-book-open' };
    const icon = (p.type && icons[p.type]) || (p.key === 'sessione-online' ? 'fa-laptop' : p.key === 'percorso-gruppo' ? 'fa-users' : p.key === 'piano-autonomo' ? 'fa-book-open' : 'fa-briefcase');
    const feats = (p.features || []).slice(0, 5);
    const btnClass = featured ? 'pv-hbtn pv-hbtn--forest' : 'pv-hbtn pv-hbtn--sage';
    const rawLabel = p.buttonLabel || '';
    let defaultLabel = 'Richiedi il servizio';
    if (/prenota/i.test(rawLabel) || p.key === 'sessione-studio') defaultLabel = 'Prenota in studio';
    else if (p.key === 'sessione-online') defaultLabel = 'Prenota online';
    else if (p.key === 'percorso-gruppo') defaultLabel = "Lista d'interesse";
    else if (p.key === 'piano-autonomo') defaultLabel = 'Acquista il piano';
    const label = esc(rawLabel || defaultLabel);
    return `
      <div class="pv-service-card${featured ? ' featured' : ''}">
        ${p.tag || featured ? `<span class="pv-service-tag">${esc(p.tag || 'Il più completo')}</span>` : ''}
        <h3><span class="pv-title-icon">${pkgIconSvg(p.iconKey, p.key)}</span> ${esc(p.name)}</h3>
        ${p.price ? `<div class="pv-service-price">${esc(p.price)}</div>` : ''}
        ${feats.length ? `<ul>${feats.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ((p.description || p.desc) ? `<p class="pv-pdesc" style="margin-top:6px;">${esc(p.description || p.desc)}</p>` : '')}
        <span class="${btnClass}">${label}</span>
      </div>`;
  }

  /* Default identici alla Home (window.__defaultServicePackages di script.js,
     che però non è caricato nella pagina admin): usati come fallback per la
     miniatura della Home finché i pacchetti non arrivano dal database. */
  const DEFAULT_PKG_DEFS = [
    { key: 'piano-autonomo', type: 'piano', title: 'Piano autonomo P.E.R.S.M.A.R.T.', price: '50 € una tantum', desc: 'Il questionario approfondito e il piano personale scritto da Valeria.', features: ['Questionario approfondito (14 domande)', 'Piano personale scritto da Valeria', 'Consegna tramite email protetta'] },
    { key: 'sessione-studio', type: 'sessione', title: 'Sessione in studio', price: '50 €/ora', desc: 'Incontro di 60 minuti nel mio studio a Valle Lomellina (PV).', features: ['Incontro individuale di 60 minuti', 'Studio a Valle Lomellina (PV)', "Piano d'azione concordato"] },
    { key: 'sessione-online', type: 'online', title: 'Sessione online', price: '50 €/ora', desc: 'Incontro di 60 minuti tramite videochiamata.', features: ['Videochiamata di 60 minuti', 'Da qualsiasi luogo', 'Stesso metodo, più flessibilità'] },
    { key: 'percorso-gruppo', type: 'gruppo', title: 'Percorsi di gruppo', price: 'Prossimo avvio', desc: "Lascia i tuoi dati per essere avvisato all'apertura delle iscrizioni.", features: ['Incontri guidati a numero chiuso', 'Obiettivi condivisi e supporto reciproco'] }
  ];

  function renderMiniHome() {
    const box = $('#pv-mini-home');
    if (!box) return;
    // Se i pacchetti non sono ancora caricati dal database, mostra subito la
    // miniatura con i default del sito (l'anteprima non resta mai vuota).
    let visible = pkgSorted().filter(p => p.active !== false && p.showInHome !== false);
    if (!packages.length) {
      const defs = Array.isArray(window.__defaultServicePackages) ? window.__defaultServicePackages : DEFAULT_PKG_DEFS;
      visible = (defs || []).map((d, i) => ({
        key: d.key, name: d.title, type: d.type, price: d.price, features: d.features,
        desc: d.desc, order: i + 1, featured: d.key === 'piano-autonomo', tag: d.tag
      }));
    }
    const cards = visible.length
      ? visible.map((p) => pvServiceCardHtml(p, p.featured || p.key === 'piano-autonomo')).join('')
      : '<p class="pv-empty">Nessun pacchetto attivo e visibile nella Home.</p>';
    box.innerHTML = `
      <div class="pv-mini-section pv-mini-hero">
        <span class="pv-mini-kicker">Mental Coach</span>
        <h4>Trasforma i tuoi obiettivi in azioni concrete.</h4>
        <p class="pv-mini-lead">Anteprima dello stile reale della sezione Hero della Home.</p>
        <div class="pv-mini-btns">
          <span class="pv-hbtn pv-hbtn--nav">Prenota una sessione</span>
          <span class="pv-hbtn pv-hbtn--light">Fai il test gratuito</span>
        </div>
      </div>
      <div class="pv-mini-section pv-mini-services">
        <span class="pv-mini-kicker">Servizi</span>
        <h4>Scegli come vuoi lavorare insieme.</h4>
        <div class="pv-mini-grid">${cards}</div>
      </div>
      <div class="pv-mini-section pv-mini-method">
        <span class="pv-mini-kicker">Metodo</span>
        <h4>Un obiettivo non basta desiderarlo. Bisogna costruirlo.</h4>
      </div>
      <div class="pv-mini-section pv-mini-testi">
        <span class="pv-mini-kicker">Recensioni</span>
        <h4>Cosa dicono di me.</h4>
      </div>
      <div class="pv-mini-section pv-mini-faq">
        <span class="pv-mini-kicker">FAQ</span>
        <h4>Le risposte che cercavi.</h4>
      </div>
      <div class="pv-mini-footer">
        <strong>Valeria Moretti</strong> · Mental Coach — sito realizzato da webnix
      </div>`;
  }

  /* Salvataggio "salvo": prima di scrivere nel DB, raccoglie TUTTI i valori
     attualmente visibili nei campioni colore e nei campi esadecimali validi,
     così nessun colore scelto con il selettore nativo va perso. */
  function syncThemeFromDom() {
    $$('input[type="color"][data-tkey]').forEach(inp => {
      if (/^#[0-9a-fA-F]{6}$/.test(inp.value)) currentTheme[inp.dataset.tkey] = inp.value.toUpperCase();
    });
    $$('input.hexv[data-thex]').forEach(inp => {
      let val = String(inp.value || '').trim();
      if (val && val[0] !== '#') val = '#' + val;
      if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val)) {
        if (val.length === 4) val = '#' + [...val.slice(1)].map(c => c + c).join('');
        currentTheme[inp.dataset.thex] = val.toUpperCase();
      }
    });
  }

  async function loadTheme() {
    setBusy(true);
    try {
      const ref = FB.doc(FB.db, THEME_COL, THEME_DOC);
      // Lettura in tempo reale: se il tema cambia (o Firebase impiega un po'
      // ad avviare la rete), griglia + anteprima si ricostruiscono da soli.
      if (FB.onSnapshot) {
        if (!loadTheme._unsub) {
          loadTheme._unsub = FB.onSnapshot(ref, (snap) => {
            // Non ricostruire le griglie mentre l'admin sta scrivendo in un
            // campo colore/esadecimale (altrimenti si perde la digitazione)
            const ae = document.activeElement;
            if (ae && (ae.matches('input[type="color"][data-tkey]') || ae.matches('input.hexv[data-thex]'))) return;
            currentTheme = snap.exists() ? { ...THEME_DEFAULTS, ...(snap.data() || {}) } : { ...THEME_DEFAULTS };
            buildColorRows('#theme-sections-grid', THEME_SECTIONS);
            buildColorRows('#theme-buttons-grid', THEME_BUTTONS);
            applyPreviewTheme(currentTheme);
          }, (err) => console.warn('onSnapshot tema:', err));
        } else {
          const snap = await FB.getDoc(ref);
          if (snap.exists()) currentTheme = { ...THEME_DEFAULTS, ...(snap.data() || {}) };
        }
      } else {
        const snap = await FB.getDoc(ref);
        if (snap.exists()) currentTheme = { ...THEME_DEFAULTS, ...(snap.data() || {}) };
      }
    } catch (err) {
      console.warn('Tema non caricato (uso default):', err);
    } finally { setBusy(false); }
    buildColorRows('#theme-sections-grid', THEME_SECTIONS);
    buildColorRows('#theme-buttons-grid', THEME_BUTTONS);
    applyPreviewTheme(currentTheme);
  }

  async function saveTheme() {
    syncThemeFromDom(); // raccoglie prima ogni valore visibile nei campi
    setBusy(true);
    try {
      // Normalizza tutti i valori in esadecimale a 6 cifre prima del salvataggio
      const clean = {};
      Object.keys(THEME_DEFAULTS).forEach(k => {
        clean[k] = hexToCss(currentTheme[k], THEME_DEFAULTS[k]);
      });
      currentTheme = clean;
      await FB.setDoc(FB.doc(FB.db, THEME_COL, THEME_DOC), { ...clean, updatedAt: new Date().toISOString() });
      buildColorRows('#theme-sections-grid', THEME_SECTIONS);
      buildColorRows('#theme-buttons-grid', THEME_BUTTONS);
      applyPreviewTheme(currentTheme);
      toast('Colori salvati ✔ La Home li applica subito (per gli utenti già sulla pagina basta un refresh).');
    } catch (err) {
      console.error(err);
      toast(permHint(err, 'colori'), true);
    } finally { setBusy(false); }
  }

  function initThemeSection() {
    buildColorRows('#theme-sections-grid', THEME_SECTIONS);
    buildColorRows('#theme-buttons-grid', THEME_BUTTONS);
    // Box "Sfondi e testi" / "Bottoni": al click la sezione attiva prende
    // sfondo bianco e icona+testo nel colore verde brand. Il click non deve
    // propagarsi agli input interni (color picker, campi esadecimali).
    const styleBoxes = document.querySelectorAll('.style-box');
    styleBoxes.forEach(box => {
      box.addEventListener('click', (e) => {
        if (e.target.closest('input, label.cl')) return;
        styleBoxes.forEach(b => b.classList.remove('active'));
        box.classList.add('active');
      });
    });
    const grid1 = $('#theme-sections-grid'), grid2 = $('#theme-buttons-grid');
    [grid1, grid2].forEach(g => {
      if (!g) return;
      g.addEventListener('input', onThemePickerChange);
      g.addEventListener('change', onThemeHexChange);
      g.addEventListener('input', onThemeHexChange);
    });
    const saveBtn = $('#btn-theme-save');
    const resetBtn = $('#btn-theme-reset');
    if (saveBtn) saveBtn.addEventListener('click', saveTheme);
    if (resetBtn) resetBtn.addEventListener('click', () => {
      confirmAction('Ripristinare i colori originali?', 'Il tema personalizzato verrà eliminato dal database e la Home tornerà ai colori di default.')
        .then(async (yes) => {
          if (!yes) return;
          setBusy(true);
          try {
            await FB.deleteDoc(FB.doc(FB.db, THEME_COL, THEME_DOC)).catch(() => {});
            currentTheme = { ...THEME_DEFAULTS };
            buildColorRows('#theme-sections-grid', THEME_SECTIONS);
            buildColorRows('#theme-buttons-grid', THEME_BUTTONS);
            applyPreviewTheme(currentTheme);
            toast('Colori originali ripristinati.');
          } catch (err) { console.error(err); toast('Errore: ' + err.message, true); }
          finally { setBusy(false); }
        });
    });
    loadTheme();
  }

  /* ==================== AIUTO: ISTRUZIONI + TOUR GUIDATA ==================== */
  function openHelp() { const o = $('#help-overlay'); if (o) o.hidden = false; }
  function closeHelp() { const o = $('#help-overlay'); if (o) o.hidden = true; }

  const TOUR_STEPS = [
    /* ---------- INTRODUZIONE ---------- */
    { section: "Introduzione", sel: ".side-brand", title: "Benvenuta nella dashboard", text: "Qui gestisci tutto il sito pubblico: testi, foto, colori, pacchetti, test e FAQ. Ogni modifica è salvata in un database online e il sito la legge subito, senza toccare il codice." },
    { section: "Introduzione", sel: ".sidebar", title: "Le sezioni della dashboard", text: "La barra a sinistra raccoglie le 7 sezioni: Recensioni, Test gratuito, Servizi e pacchetti, Colori & stile, Aggiornamenti foto, Aggiornamento social e FAQ. La voce attiva resta evidenziata; in basso trovi il tuo account e Esci." },
    { section: "Introduzione", sel: "#btn-istruzioni", title: "Istruzioni complete", text: "Qui c'è la guida scritta di ogni singolo campo, sezione per sezione, e in fondo una parte di domande e risposte sui casi più comuni: permessi di Firebase, foto che non compaiono, colori illeggibili, eliminazioni. Puoi riaprirla quando vuoi." },
    { section: "Introduzione", sel: "#preview-pane", title: "Anteprima live", text: "La colonna a destra resta vuota finché non inizi a compilare i campi di una sezione: appena scrivi compare SOLO l'anteprima di quella sezione, aggiornata mentre digiti. Così non ti distrae con contenuti che non stai modificando." },
    { section: "Introduzione", sel: "#preview-note", title: "Come si attiva", text: "Basta un carattere scritto in un campo, un colore cambiato o un pulsante premuto dentro la sezione: l'anteprima di quella sezione appare subito. Cambiando sezione torna vuota, pronta per il lavoro successivo." },

    /* ---------- RECENSIONI ---------- */
    { section: "Recensioni", sel: '[data-panel="recensioni"]', title: "Recensioni — cosa contiene", text: "Da qui gestisci le testimonianze che compaiono in Home nella sezione «Cosa dicono di me». Il modulo in alto aggiunge una recensione, la tabella sotto elenca quelle già pubblicate." },
    { section: "Recensioni", sel: "#rev-name", title: "Nome", text: "Scrivi il nome della persona, es. «Maria». In Home comparirà insieme all'iniziale del cognome. Massimo 60 caratteri: è un campo obbligatorio." },
    { section: "Recensioni", sel: "#rev-initial", title: "Iniziale del cognome", text: "Una sola lettera, es. «R»: per privacy si pubblica «Maria R.» e non il cognome completo. Il campo accetta un solo carattere e lo converte in maiuscolo." },
    { section: "Recensioni", sel: "#rev-star-rating", title: "Stelle (da 1 a 5)", text: "Passa il mouse: le stelle si illuminano in giallo. Clicca il numero di stelle da assegnare, il contatore accanto mostra «N / 5». La valutazione è sempre piena da sinistra verso destra, come nelle recensioni classiche." },
    { section: "Recensioni", sel: "#rev-date", title: "Data", text: "Indica quando è stata lasciata la recensione. In Home l'elenco è ordinato dalla più recente: se la data non è corretta la recensione finisce nella posizione sbagliata." },
    { section: "Recensioni", sel: "#rev-text", title: "Descrizione", text: "Il testo completo della testimonianza. In Home i testi lunghi mostrano automaticamente il pulsante «Leggi di più». Pubblica solo recensioni reali e autorizzate." },
    { section: "Recensioni", sel: '#review-form button[type="submit"]', title: "Salva recensione", text: "Scrive nel database e pubblica la recensione in Home. In modifica diventa «Aggiorna recensione»: il modulo resta compilato finché non premi «Annulla modifica»." },
    { section: "Recensioni", sel: "#rev-search", title: "Cerca", text: "Filtra la tabella mentre digiti: basta una lettera del nome o dell'iniziale del cognome. Serve solo a trovare una voce, non modifica né elimina nulla." },
    { section: "Recensioni", sel: "#panel-recensioni .tbl-wrap", title: "Elenco e azioni", text: "Ogni riga mostra nome, iniziale, stelle, data e testo. La matita carica la recensione nel modulo per correggerla, il cestino la elimina dopo conferma (l'eliminazione è definitiva)." },
    { section: "Recensioni", sel: "#preview-pane", title: "Perché non vedi l'anteprima", text: "Le recensioni non hanno un blocco di anteprima: sono pensate per essere lette nel contesto della Home. Dopo il salvataggio, Aprila Home per vederle nella sezione «Cosa dicono di me»." },

    /* ---------- TEST GRATUITO ---------- */
    { section: "Test gratuito", sel: '[data-panel="test"]', title: "Test gratuito — cosa contiene", text: "Qui gestisci le domande del questionario che si apre con «Fai il test gratuito». Le domande hanno risposte solo testuali: le risposte scelte dal visitatore ti arrivano via email, il test non calcola punteggi né profili." },
    { section: "Test gratuito", sel: "#panel-test .card", title: "Elenco delle domande", text: "Le frecce ↑ ↓ cambiano l'ordine in cui le domande compaiono nel test; l'interruttore Attiva/Disattiva decide se la domanda partecipa; la matita la modifica e il cestino la elimina dopo conferma." },
    { section: "Test gratuito", sel: "#q-text", title: "Testo della domanda", text: "Scrivila in modo concreto, così le risposte sono immediate. Esempio: «Quando ricevi un messaggio dalla persona che stai frequentando:». Il testo appare nel popup esattamente come lo scrivi qui." },
    { section: "Test gratuito", sel: "#options-editor", title: "Risposte disponibili", text: "Ogni riga è una risposta che il visitatore può scegliere: scrivi solo il testo, niente profili A/B/C né punteggi. Servono almeno due risposte; la ✕ su una riga la rimuove." },
    { section: "Test gratuito", sel: "#btn-add-option", title: "Aggiungi risposta", text: "Crea una nuova riga vuota per un'altra risposta. Puoi aggiungerne quante vuoi: il visitatore le vedrà tutte, nello stesso ordine in cui le hai scritte." },
    { section: "Test gratuito", sel: '#question-form button[type="submit"]', title: "Salva domanda", text: "Pubblica la domanda nel popup del test in Home. In modifica diventa «Salva modifiche» e compare «Annulla modifica» per tornare alla creazione di una domanda nuova." },
    { section: "Test gratuito", sel: '[data-preview="test"]', title: "Anteprima della bozza", text: "Appena scrivi, la colonna di destra mostra la domanda con le risposte già composte: è esattamente ciò che vedrà il visitatore nel popup." },

    /* ---------- SERVIZI E PACCHETTI ---------- */
    { section: "Servizi e pacchetti", sel: "#panel-servizi .tbl-wrap", title: "Tabella dei pacchetti", text: "Ogni riga è una card della Home. Le frecce ↑↓ cambiano l'ordine, «Attivo» spegne il pacchetto per i visitatori, «In Home» lo nasconde solo dalla vetrina, la matita lo modifica, «duplica» crea una copia e il cestino elimina dopo conferma." },
    { section: "Servizi e pacchetti", sel: "#pkg-name", title: "Nome del servizio", text: "Il titolo della card, es. «Sessione in studio». Compare nella Home e nel popup di richiesta del pacchetto." },
    { section: "Servizi e pacchetti", sel: "#pkg-price", title: "Prezzo", text: "Testo libero: va bene «50 €/ora», «Prossimo avvio» o «Su richiesta». Lascialo vuoto se non vuoi mostrare alcun prezzo." },
    { section: "Servizi e pacchetti", sel: "#features-editor", title: "Punti elenco", text: "Un beneficio per riga: vengono mostrati come elenco con la spunta nella card e nel popup. Premi Invio dentro una riga per crearne subito un'altra; la ✕ la elimina." },
    { section: "Servizi e pacchetti", sel: "#btn-add-feature", title: "Aggiungi punto elenco", text: "Aggiunge una riga vuota in fondo all'elenco. Se lasci tutti i punti vuoti, la card mostra solo la descrizione del pacchetto." },
    { section: "Servizi e pacchetti", sel: "#pkg-tag", title: "Etichetta card", text: "È il badge in alto sulla card, es. «Il più completo». Se lo lasci vuoto non compare alcuna etichetta: usalo su un solo pacchetto per non confondere i visitatori." },
    { section: "Servizi e pacchetti", sel: "#iconOptions", title: "Icona del pacchetto", text: "Clicca una delle icone proposte: quella con la spunta appare accanto al nome nella card e nel popup. Le icone rappresentano situazioni diverse: singolo, coppia, gruppo, documento, calendario, obiettivo, messaggio." },
    { section: "Servizi e pacchetti", sel: "#pkg-switches", title: "Attivo e Mostra nella Home", text: "«Attivo» spegne completamente il pacchetto (non esiste più per i visitatori). «Mostra nella Home» lo tiene attivo ma fuori dalla vetrina della Home. Puoi impostarli già alla creazione." },
    { section: "Servizi e pacchetti", sel: '#package-form button[type="submit"]', title: "Salva pacchetto", text: "Crea o aggiorna la card in Home. In modifica compare «Annulla modifica» per uscire senza cambiare nulla. L'identificativo interno lo genera il sistema: non c'è nulla da scrivere." },

    /* ---------- COLORI & STILE ---------- */
    { section: "Colori & stile", sel: "#box-sezioni", title: "Sfondi e testi delle sezioni", text: "Questo riquadro raccoglie i colori di ogni area del sito: sfondo generale, Hero, Blocchi, Metodo, Servizi, Card pacchetto, Recensioni, FAQ, Studio e Footer. Cliccando un riquadro diventa quello attivo." },
    { section: "Colori & stile", sel: "#theme-sections-grid", title: "Una card per ogni sezione", text: "Ogni card contiene due righe indipendenti: «sfondo» e «testo». Puoi cambiare solo lo sfondo e lasciare il testo com'è. Appena cambi un colore, l'anteprima a destra mostra il risultato." },
    { section: "Colori & stile", sel: "#tc-heroBg", title: "Campione colore", text: "Clicca il quadratino per aprire il selettore del sistema e scegliere il colore: il valore viene scritto anche nel campo accanto e l'anteprima a destra si attiva mostrando la Home con il nuovo colore." },
    { section: "Colori & stile", sel: "#hv-heroBg", title: "Codice esadecimale", text: "Puoi scrivere il codice a mano: «#315B55» oppure la forma breve «#3B5». Se il codice non è valido il campo torna all'ultimo valore corretto, così non salvi colori sbagliati. Anche qui l'anteprima si aggiorna mentre digiti." },
    { section: "Colori & stile", sel: "#box-bottoni", title: "Bottoni", text: "Qui imposti separatamente sfondo e testo per ogni famiglia di bottoni: primari verdi, chiari, salvia delle card e bottone della navbar con la CTA del menu mobile. Il cambio vale per tutti i bottoni di quella famiglia." },
    { section: "Colori & stile", sel: "#theme-buttons-grid", title: "Sfondo e testo, separati", text: "Ogni bottone ha due righe: una per lo sfondo e una per il testo (le icone seguono il colore del testo). Se un testo non si legge, cambia solo la riga «testo» senza toccare lo sfondo." },
    { section: "Colori & stile", sel: "#btn-theme-save", title: "Salva colori", text: "Scrive il tema nel database: la Home pubblica si aggiorna subito, anche per chi ha la pagina già aperta. Finché non premi questo pulsante i colori restano solo nell'anteprima." },
    { section: "Colori & stile", sel: "#btn-theme-reset", title: "Ripristina colori originali", text: "Chiede conferma, cancella il tema personalizzato dal database e riporta il sito ai colori di partenza. L'operazione non è annullabile: annota le scelte se vuoi poterle rifare." },

    /* ---------- AGGIORNAMENTI FOTO ---------- */
    { section: "Aggiornamenti foto", sel: "#foto-card-hero", title: "1 · Foto Hero", text: "Sono le immagini del riquadro grande accanto al titolo della Home, dietro alla targhetta «Valeria Moretti · Mental Coach». La prima appare subito, poi cambiano automaticamente ogni 4 secondi." },
    { section: "Aggiornamenti foto", sel: "#hero-slots .photo-url-input", title: "Link della foto", text: "Incolla l'indirizzo diretto dell'immagine: deve iniziare con https:// e puntare a un file jpg, png o webp. La miniatura a sinistra mostra l'anteprima; se resta vuota il link non è valido o non è pubblico." },
    { section: "Aggiornamenti foto", sel: "#btn-hero-add", title: "Aggiungi un'altra foto", text: "Crea una nuova riga vuota sotto le esistenti (fino a 12 per gruppo) e porta il cursore nel campo nuovo. Con più foto l'immagine ruota automaticamente ogni 4 secondi." },
    { section: "Aggiornamenti foto", sel: "#btn-hero-save", title: "Salva (solo questo gruppo)", text: "Salva solo le foto della Hero. Ogni gruppo ha il suo pulsante Salva; in fondo alla pagina «Salva foto» salva tutti i gruppi in una volta." },
    { section: "Aggiornamenti foto", sel: "#foto-card-about", title: "2 · Foto «Chi sono»", text: "Il riquadro verticale accanto a «Ciao, sono Valeria». Funziona come la Hero: incolla i link, «Aggiungi un'altra foto» per una riga nuova, ✕ per rimuovere, Salva per pubblicare. Deve restare almeno una foto." },
    { section: "Aggiornamenti foto", sel: "#foto-card-studio", title: "3 · Foto «Il mio Studio»", text: "L'immagine della sezione «Il mio Studio» della Home. Questo gruppo può anche essere svuotato: in quel caso resta la foto attuale del sito." },
    { section: "Aggiornamenti foto", sel: "#btn-photos-save", title: "Salva tutte le foto", text: "Salva Hero, Chi sono e Studio insieme. Accanto, «Ripristina foto originali» cancella le foto personalizzate dal database e rimette quelle di partenza." },

    /* ---------- AGGIORNAMENTO SOCIAL ---------- */
    { section: "Aggiornamento social", sel: "#social-fields", title: "Link social e contatti", text: "Qui modifichi i canali del sito: Instagram, TikTok, YouTube, Telegram, WhatsApp, numero di telefono ed email. Ciò che salvi aggiorna footer, popup «Scegli la modalità» e pulsanti social." },
    { section: "Aggiornamento social", sel: '[data-key="whatsapp"]', title: "Attenzione al formato", text: "WhatsApp vuole il formato https://wa.me/39NUMERO (prefisso internazionale, senza spazi). Telegram: https://t.me/tuousername. Il link di una pagina, invece del profilo, non funziona." },
    { section: "Aggiornamento social", sel: "#pixel-help-btn", title: "Facebook Pixel", text: "Il «?» apre la guida in 4 passi per recuperare l'ID del set di dati da Meta Events Manager. Incolla solo i numeri nel campo: il sito inserisce da sé il codice di tracciamento. «Rimuovi pixel» lo disattiva." },
    { section: "Aggiornamento social", sel: "#btn-social-save", title: "Salva social", text: "Aggiorna tutto il sito in tempo reale. I campi lasciati vuoti non cancellano nulla: restano i link già pubblicati. «Ripristina default» rimette i link originali." },

    /* ---------- FAQ ---------- */
    { section: "FAQ", sel: "#faq-q", title: "Domanda", text: "Scrivi la domanda come la leggono i visitatori, es. «Che cos'è la consulenza relazionale?». Compare nella sezione «Le risposte che cercavi» della Home." },
    { section: "FAQ", sel: "#faq-a", title: "Risposta", text: "Il testo che si apre cliccando la domanda: puoi scrivere più frasi, l'accordion si adatta. Meglio risposte chiare e complete, senza rimandare ad altre pagine." },
    { section: "FAQ", sel: "#btn-faq-add", title: "Salva domanda", text: "Pubblica subito la domanda in Home. In modifica diventa «Salva modifiche» e compare il badge «stai modificando una domanda esistente»." },
    { section: "FAQ", sel: "#panel-faq > .card:last-of-type", title: "Domande pubblicate", text: "L'interruttore «Attiva» nasconde la domanda senza cancellarla, le frecce ↑↓ cambiano l'ordine, la matita la riporta nel modulo e il cestino la elimina dopo conferma." },

    /* ---------- ANTEPRIMA LIVE ---------- */
    { section: "Anteprima live", sel: "#preview-pane", title: "Cosa mostra l'anteprima", text: "L'anteprima mostra solo la sezione su cui stai lavorando e solo dopo che inizi a compilare i campi: niente elenchi infiniti, solo il risultato di ciò che stai modificando." },
    { section: "Anteprima live", sel: "#btn-preview-refresh", title: "Aggiorna", text: "Rilegge il database e ridisegna l'anteprima della sezione attiva: utile dopo una modifica fatta da un altro dispositivo o se qualcosa non ti torna." },

    /* ---------- CONCLUSIONE ---------- */
    { section: "Conclusione", sel: "#btn-tutorial", title: "Ripeti il tutorial", text: "Puoi rivedere questo tour quando vuoi da qui. Con «Salta sezione» passi alle spiegazioni della sezione successiva, con Esc o «Chiudi» interrompi e riprendi più tardi." },
    { section: "Conclusione", sel: ".side-user", title: "Sei pronto!", text: "Qui vedi l'account collegato e il pulsante Esci. Ricorda: niente va online finché non premi il pulsante di salvataggio della sezione. Buon lavoro!" },
  ];

  let tourIdx = -1;
  const tourEls = {};

  function tourVisible(sel) {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 2 && r.height < 2) return null;
    // se l'elemento appartiene a un pannello non attivo, scrolla/attiva prima
    return el;
  }

  function tourEnsurePanel(sel) {
    // se il target è dentro un pannello nascosto, attiva quel pannello
    const el = document.querySelector(sel);
    if (!el) return;
    // Se il target è dentro l'anteprima (che resta vuota finché non si scrive),
    // rende visibile il blocco della sezione corrispondente prima di misurarlo.
    const block = el.closest('.pv-block');
    if (block && block.dataset.preview) {
      const key = block.dataset.preview;
      if (activePanelKey !== key) switchPanel(key);
      previewActivated[key] = true;
      updatePreviewGate();
    }
    // Se il target è una voce della barra laterale, apre la sezione di cui parla.
    if (el.matches && el.matches('.side-btn[data-panel]')) switchPanel(el.dataset.panel);
    const panel = el.closest('.panel');
    if (panel && !panel.classList.contains('active')) {
      const btn = document.querySelector(`.side-btn[data-panel="${panel.id.replace('panel-', '')}"]`);
      if (btn) switchPanel(btn.dataset.panel);
    }
  }

  /* Indice del primo passaggio della sezione successiva (per «Salta sezione»). */
  function tourNextSectionIdx(from) {
    const cur = (TOUR_STEPS[from] || {}).section;
    for (let i = from + 1; i < TOUR_STEPS.length; i++) {
      if (TOUR_STEPS[i].section !== cur) return i;
    }
    return -1;
  }

  function tourPlace(i) {
    const step = TOUR_STEPS[i];
    if (!step) return;
    tourEnsurePanel(step.sel);
    requestAnimationFrame(() => {
      let el = tourVisible(step.sel);
      if (!el) { // fallback: evidenzia la sidebar / centro schermo
        el = document.querySelector('.sidebar') || document.body;
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        const pad = 6;
        const vw = window.innerWidth, vh = window.innerHeight;
        const r = el.getBoundingClientRect();
        // Ritaglio l'area evidenziata alla finestra: un elemento più alto dello
        // schermo (es. una griglia lunga) non deve far uscire il riquadro.
        const holeLeft = Math.max(0, Math.min(vw - 8, r.left - pad));
        const holeTop = Math.max(0, Math.min(vh - 8, r.top - pad));
        const holeRight = Math.min(vw, Math.max(holeLeft + 24, r.right + pad));
        const holeBottom = Math.min(vh, Math.max(holeTop + 24, r.bottom + pad));
        const hole = tourEls.hole;
        hole.setAttribute('x', holeLeft);
        hole.setAttribute('y', holeTop);
        hole.setAttribute('width', holeRight - holeLeft);
        hole.setAttribute('height', holeBottom - holeTop);
        // posizione card: sotto l'area evidenziata se c'è spazio, altrimenti sopra o a destra
        const card = tourEls.card;
        const cw = card.offsetWidth, ch = card.offsetHeight;
        let left = holeLeft, top = holeBottom + 14;
        if (top + ch > vh - 12) top = Math.max(12, holeTop - ch - 14);
        if (top < 12) { left = holeRight + 14; top = Math.max(12, Math.min(holeTop, vh - ch - 12)); }
        if (left + cw > vw - 12) left = vw - cw - 12;
        if (left < 12) left = 12;
        if (top + ch > vh - 12) top = Math.max(12, vh - ch - 12);
        card.style.left = left + 'px';
        card.style.top = top + 'px';
      }, 260);
      if (tourEls.section) tourEls.section.textContent = step.section || '';
      tourEls.counter.textContent = `Passaggio ${i + 1} / ${TOUR_STEPS.length}`;
      tourEls.title.textContent = step.title;
      tourEls.text.textContent = step.text;
      tourEls.prev.hidden = i === 0;
      const nextSection = tourNextSectionIdx(i);
      if (tourEls.skipSection) tourEls.skipSection.hidden = nextSection < 0;
      tourEls.next.innerHTML = i === TOUR_STEPS.length - 1
        ? 'Fine <i class="fa-solid fa-check"></i>'
        : 'Avanti <i class="fa-solid fa-arrow-right"></i>';
    });
  }

  function startTour() {
    closeHelp();
    tourEls.overlay = $('#tour-overlay');
    tourEls.hole = $('#tour-hole');
    tourEls.card = $('#tour-card');
    tourEls.counter = $('#tour-counter');
    tourEls.section = $('#tour-section');
    tourEls.title = $('#tour-title');
    tourEls.text = $('#tour-text');
    tourEls.prev = $('#tour-prev');
    tourEls.next = $('#tour-next');
    tourEls.skipSection = $('#tour-skip-section');
    tourEls.overlay.hidden = false;
    tourIdx = 0;
    tourPlace(tourIdx);
  }

  function stopTour() {
    if (tourEls.overlay) tourEls.overlay.hidden = true;
    tourIdx = -1;
  }

  function initHelpSection() {
    $('#btn-istruzioni').addEventListener('click', openHelp);
    $('#btn-tutorial').addEventListener('click', startTour);
    $('#help-close').addEventListener('click', closeHelp);
    $('#help-close-2').addEventListener('click', closeHelp);
    $('#help-start-tour').addEventListener('click', startTour);
    $('#help-overlay').addEventListener('click', (e) => { if (e.target.id === 'help-overlay') closeHelp(); });
    $('#tour-next').addEventListener('click', () => {
      if (tourIdx >= TOUR_STEPS.length - 1) { stopTour(); toast('Tutorial completata! 🎉'); return; }
      tourIdx++; tourPlace(tourIdx);
    });
    $('#tour-prev').addEventListener('click', () => { if (tourIdx > 0) { tourIdx--; tourPlace(tourIdx); } });
    $('#tour-skip').addEventListener('click', stopTour);
    const skipSec = $('#tour-skip-section');
    if (skipSec) skipSec.addEventListener('click', () => {
      const next = tourNextSectionIdx(tourIdx);
      if (next < 0) { stopTour(); toast('Tour completato 🎉'); return; }
      tourIdx = next;
      tourPlace(tourIdx);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeHelp(); if (tourIdx >= 0) stopTour(); }
    });
    window.addEventListener('resize', () => { if (tourIdx >= 0) tourPlace(tourIdx); });
  }

  /* =========================== BOOTSTRAP ======================== */
  let dashInited = false;
  async function initDashboard() {
    if (dashInited) return;
    dashInited = true;
    $$('.side-btn').forEach(b => b.addEventListener('click', () => switchPanel(b.dataset.panel)));
    // Prima: se il nuovo database è vuoto, importa i contenuti di default
    // (recensioni, domande test, pacchetti). Poi carica le sezioni.
    try { await ensureDefaultData(); } catch (e) { console.warn('ensureDefaultData:', e); }
    // Ogni sezione è isolata: se una fallisce, le altre restano comunque
    // utilizzabili (prima un solo errore bloccava tutta la dashboard).
    [
      ['recensioni', initReviewsSection],
      ['test', initQuizSection],
      ['servizi', initServicesSection],
      ['colori', initThemeSection],
      ['foto', initPhotosSection], // sezione "Aggiornamenti foto" + anteprima live hero/chisono/studio
      ['social', initSocialSection], // sezione "Aggiornamento social" + anteprima live footer/popup
      ['faq', initFaqSection], // sezione "FAQ" (Home «Le risposte che cercavi») + anteprima live
      ['aiuto', initHelpSection], // bottoni Istruzioni + Tutorial con tour interattivo spotlight
      ['gate-anteprima', initPreviewGate], // l'anteprima appare solo nella sezione in cui scrivi
      ['anteprima', initDraftLivePreview] // anteprima live si aggiorna mentre scrivi nei form
    ].forEach(([name, fn]) => {
      try { fn(); } catch (err) { console.error('Init sezione "' + name + '" fallita:', err); }
    });
    // Anteprima live: aggiorna anche manualmente
    const rb = $('#btn-preview-refresh');
    if (rb) rb.addEventListener('click', () => {
      loadReviews(); loadQuiz(); loadServices(); loadFaq();
      // «Aggiorna» è una richiesta esplicita: mostra l'anteprima della sezione attiva.
      previewActivated[activePanelKey] = true;
      updatePreviewGate();
      setTimeout(renderLivePreview, 700);
      toast('Anteprima aggiornata.');
    });
  }

  async function boot() {
    const ok = await waitFirebase();
    if (!ok) {
      showLogin('Firebase non disponibile: verifica la connessione e ricarica.');
      return;
    }
    $('#btn-login-google').addEventListener('click', doLogin);
    $('#btn-logout').addEventListener('click', async () => {
      try { await FB.signOut(FB.auth); toast('Disconnesso.'); } catch (e) { console.error(e); }
    });
    FB.onAuthStateChanged(FB.auth, (user) => {
      if (user && isAdmin(user)) showDashboard(user);
      else if (user) {
        FB.signOut(FB.auth);
        showLogin('Accesso negato: questo account non è abilitato alla dashboard.');
      } else {
        showLogin();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
