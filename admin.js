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
      allReviews = await fsGetAll(REV_COL);
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
      console.error(err); toast('Errore salvataggio: ' + err.message, true);
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
      console.error(err); toast('Errore eliminazione: ' + err.message, true);
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
          ${(q.answers || []).map(a => `<li>${esc(a.text)} <span class="badge badge--info">${esc(a.profile)}</span></li>`).join('')}
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
      renderQuestionsListAndPreview();
      // titolo da config/site_config
      const snap = await FB.getDoc(FB.doc(FB.db, CONFIG_COL, CONFIG_DOC));
      const cfg = snap.exists() ? snap.data() : {};
      quizTitle = (cfg.general && cfg.general.quizTitle) || cfg.quizTitle || '';
      $('#quiz-title-input').value = quizTitle;
      if (quizQuestions.length === 0) await seedQuizFromDefaults();
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
      // importa anche titolo e profili-risultato in config/site_config
      const cfgPayload = { general: { quizTitle: window.__defaultQuizTitle || '' } };
      if (window.__defaultQuizResults) {
        cfgPayload.quiz = { profiles: {} };
        Object.entries(window.__defaultQuizResults).forEach(([k, v]) => {
          cfgPayload.quiz.profiles[k] = { title: v.title, subtitle: v.subtitle, description: v.description };
        });
      }
      await FB.setDoc(FB.doc(FB.db, CONFIG_COL, CONFIG_DOC), cfgPayload, { merge: true });
      $('#quiz-title-input').value = window.__defaultQuizTitle || '';
      quizQuestions = await fsGetAll(QUIZ_COL);
      renderQuestionsListAndPreview();
      toast('Test attuale importato nel database: ora è modificabile.');
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  }

  /* --- editor risposte nel form domanda --- */
  function optionRow(text = '', profile = 'A') {
    const div = document.createElement('div');
    div.className = 'opt-row';
    div.innerHTML = `
      <input type="text" value="${esc(text)}" placeholder="Testo della risposta…" data-opt-text />
      <select class="profile-sel" data-opt-profile>
        ${['A', 'B', 'C', 'D'].map(p => `<option value="${p}" ${p === profile ? 'selected' : ''}>Profilo ${p}</option>`).join('')}
      </select>
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
    ed.appendChild(optionRow('', 'A'));
    ed.appendChild(optionRow('', 'B'));
  }

  function fillQuestionForm(q) {
    $('#q-edit-key').value = q.id;
    $('#q-text').value = q.text || '';
    $('#question-form-title').textContent = 'Modifica domanda';
    $('#q-cancel-edit').hidden = false;
    const ed = $('#options-editor');
    ed.innerHTML = '';
    (q.answers || []).forEach(a => ed.appendChild(optionRow(a.text, a.profile)));
    if (!(q.answers || []).length) { ed.appendChild(optionRow('', 'A')); ed.appendChild(optionRow('', 'B')); }
    document.getElementById('panel-test').scrollIntoView({ behavior: 'smooth' });
  }

  async function saveQuestion(e) {
    e.preventDefault();
    const key = $('#q-edit-key').value || ('q-' + Date.now().toString(36));
    const text = $('#q-text').value.trim();
    const answers = $$('#options-editor .opt-row').map(row => ({
      text: row.querySelector('[data-opt-text]').value.trim(),
      profile: row.querySelector('[data-opt-profile]').value
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
    } catch (err) { console.error(err); toast('Errore salvataggio: ' + err.message, true); }
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
    } catch (err) { console.error(err); toast('Errore eliminazione: ' + err.message, true); }
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
    } catch (err) { console.error(err); toast('Errore riordino: ' + err.message, true); }
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

  async function saveQuizSettings() {
    const title = $('#quiz-title-input').value.trim();
    if (!title) { toast('Inserisci un titolo.', true); return; }
    setBusy(true);
    try {
      await FB.setDoc(FB.doc(FB.db, CONFIG_COL, CONFIG_DOC),
        { general: { quizTitle: title } }, { merge: true });
      quizTitle = title;
      toast('Titolo del test salvato: aggiornato sul sito.');
    } catch (err) { console.error(err); toast('Errore salvataggio: ' + err.message, true); }
    finally { setBusy(false); }
  }

  function initQuizSection() {
    resetQuestionForm();
    $('#question-form').addEventListener('submit', saveQuestion);
    $('#q-cancel-edit').addEventListener('click', resetQuestionForm);
    $('#btn-add-option').addEventListener('click', () => $('#options-editor').appendChild(optionRow()));
    $('#btn-save-quiz-settings').addEventListener('click', saveQuizSettings);
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
        <td><strong>${esc(p.name)}</strong><br /><span style="font-size:12px;color:#888;">${esc(p.type || '')} · <code>${esc(p.key || p.id)}</code></span></td>
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

  function renderCustomQuestions() {
    const list = [...customQuestions].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    const typeLabel = { short: 'Risposta breve', long: 'Risposta lunga', multiple: 'Scelta multipla', checkbox: 'Caselle di selezione' };
    $('#custom-questions-list').innerHTML = list.map(q => `
      <div class="q-item">
        <div class="q-item-head">
          <span class="q-text">${esc(q.text)}</span>
          <span class="badge badge--info">${typeLabel[q.fieldType] || esc(q.fieldType)}</span>
          <span class="badge ${q.required ? 'badge--on' : 'badge--off'}">${q.required ? 'Obbligatoria' : 'Facoltativa'}</span>
        </div>
        ${q.options && q.options.length ? `<p style="font-size:12.5px;color:#666;margin:0 0 8px 30px;">Opzioni: ${q.options.map(esc).join(' · ')}</p>` : ''}
        <p style="font-size:12.5px;margin:0 0 8px 30px;">Pacchetti collegati: ${packages.length ? packages.map(p => `<label style="margin-right:12px;font-weight:400;"><input type="checkbox" data-cq-pkg="${esc(q.id)}" data-pkg="${esc(p.key || p.id)}" ${(p.questionKeys || []).includes(q.id) ? 'checked' : ''} /> ${esc(p.name)}</label>`).join('') : '<span style="color:#999;">nessun pacchetto</span>'}</p>
        <div class="q-actions" style="margin-left:30px;">
          <button class="btn btn--soft btn--sm" data-cq-toggle-req="${esc(q.id)}"><i class="fa-solid fa-asterisk"></i> ${q.required ? 'Rendi facoltativa' : 'Rendi obbligatoria'}</button>
          <button class="btn btn--danger btn--sm" data-cq-del="${esc(q.id)}"><i class="fa-solid fa-trash-can"></i> Elimina</button>
        </div>
      </div>`).join('');
    if (!list.length) $('#custom-questions-list').innerHTML = '<p class="empty-note">Nessuna domanda personalizzata: il popup mostrerà solo Nome, Cognome ed Email.</p>';
  }

  function renderRequests() {
    const list = [...requests].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    $('#requests-tbody').innerHTML = list.map(r => {
      const body = Object.entries(r.answers || {})
        .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${Array.isArray(v) ? v.map(esc).join(', ') : esc(v)}</dd>`).join('');
      return `<tr><td style="white-space:nowrap;">${esc((r.createdAt || '').slice(0, 16).replace('T', ' '))}</td><td>
        <details class="req-card" style="border:none;border-left:4px solid var(--salvia);padding:10px 14px;margin:0;">
          <summary><strong>${esc(r.nome || '')} ${esc(r.cognome || '')}</strong> — ${esc(r.servizio || r.packageKey || '')} <span style="color:#999;font-weight:400;font-size:12px;"><i class="fa-solid fa-envelope"></i> ${esc(r.email || '')}</span></summary>
          <div class="req-body"><dl>${body}</dl></div>
        </details></td></tr>`;
    }).join('');
    $('#requests-empty').hidden = list.length > 0;
  }

  async function loadServices() {
    setBusy(true);
    try {
      const [pkgs, cqs, reqs] = await Promise.all([
        fsGetAll(PKG_COL), fsGetAll(CQ_COL), fsGetAll(REQ_COL)
      ]);
      packages = pkgs; customQuestions = cqs; requests = reqs;
      renderPackagesAndPreview(); renderCustomQuestions(); renderRequests();
      if (packages.length === 0) await seedPackagesFromDefaults();
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

  function resetPackageForm() {
    $('#package-form').reset();
    $('#pkg-edit-key').value = '';
    $('#pkg-form-title').textContent = 'Aggiungi un nuovo pacchetto';
    $('#pkg-cancel-edit').hidden = true;
    $('#pkg-active').checked = true;
    $('#pkg-visible').checked = true;
  }

  function fillPackageForm(p, asNew) {
    if (asNew) {
      // modalità «duplica»: crea un pacchetto nuovo precompilato
      $('#pkg-edit-key').value = '';
      $('#pkg-key').value = p.key || '';
      $('#pkg-key').disabled = false;
    } else {
      $('#pkg-edit-key').value = p.id;
      $('#pkg-key').value = p.key || p.id;
      $('#pkg-key').disabled = true;
    }
    $('#pkg-name').value = p.name || '';
    $('#pkg-type').value = p.type || '';
    $('#pkg-price').value = p.price || '';
    $('#pkg-desc').value = p.desc || '';
    $('#pkg-features').value = (p.features || []).join('\n');
    $('#pkg-tag').value = p.tag || '';
    $('#pkg-btn-label').value = p.buttonLabel || '';
    $('#pkg-active').checked = p.active !== false;
    $('#pkg-visible').checked = p.showInHome !== false;
    $('#pkg-form-title').textContent = asNew ? 'Duplica pacchetto: ' + p.name : (p.id ? 'Modifica pacchetto: ' + p.name : 'Aggiungi un nuovo pacchetto');
    $('#pkg-cancel-edit').hidden = !p.id;
    document.getElementById('panel-servizi').scrollIntoView({ behavior: 'smooth' });
  }

  async function savePackage(e) {
    e.preventDefault();
    const editId = $('#pkg-edit-key').value;
    const key = $('#pkg-key').value.trim().toLowerCase();
    if (!/^[a-z0-9\-]+$/.test(key)) { toast('L\'identificativo deve contenere solo lettere minuscole, numeri e trattini.', true); return; }
    const dup = packages.find(p => (p.key === key) && p.id !== editId);
    if (dup) { toast('Esiste già un pacchetto con questo identificativo.', true); return; }
    const existing = editId ? packages.find(p => p.id === editId) : null;
    const data = {
      key,
      name: $('#pkg-name').value.trim(),
      type: $('#pkg-type').value.trim(),
      price: $('#pkg-price').value.trim(),
      desc: $('#pkg-desc').value.trim(),
      features: $('#pkg-features').value.split('\n').map(s => s.trim()).filter(Boolean),
      tag: $('#pkg-tag').value.trim(),
      buttonLabel: $('#pkg-btn-label').value.trim(),
      actionUrl: existing ? (existing.actionUrl || '') : '',
      active: $('#pkg-active').checked,
      showInHome: $('#pkg-visible').checked,
      questionKeys: existing ? (existing.questionKeys || []) : [],
      order: existing ? Number(existing.order) : (pkgSorted().length + 1)
    };
    setBusy(true);
    try {
      if (editId) await fsSet(PKG_COL, editId, data); // setDoc usa merge:true → non perde i campi non esposti nel form
      else await fsSet(PKG_COL, 'pkg-' + key, data);  // nuovo pacchetto: documento completo
      toast('Pacchetto salvato: aggiornato nella Home e nel popup.');
      $('#pkg-key').disabled = false;
      resetPackageForm();
      packages = await fsGetAll(PKG_COL);
      renderPackagesAndPreview();
    } catch (err) { console.error(err); toast('Errore salvataggio: ' + err.message, true); }
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
    } catch (err) { console.error(err); toast('Errore eliminazione: ' + err.message, true); }
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

  /* ---- domande personalizzate del modulo ---- */
  async function addCustomQuestion(e) {
    e.preventDefault();
    const text = $('#cq-text').value.trim();
    const fieldType = $('#cq-type').value;
    const required = $('#cq-required').checked;
    let options = [];
    if (fieldType === 'multiple' || fieldType === 'checkbox') {
      options = $('#cq-options').value.split(',').map(s => s.trim()).filter(Boolean);
      if (options.length < 2) { toast('Per scelta multipla / caselle servono almeno 2 opzioni (separate da virgola).', true); return; }
    }
    setBusy(true);
    try {
      const id = 'cq-' + Date.now().toString(36);
      await fsSet(CQ_COL, id, { text, fieldType, required, options, order: customQuestions.length + 1, active: true });
      // collega la domanda a TUTTI i pacchetti attivi (modulo di richiesta comune);
      // l'associazione per singolo pacchetto resta possibile via questionKeys
      customQuestions = await fsGetAll(CQ_COL);
      renderCustomQuestions();
      toast('Domanda aggiunta al modulo di richiesta.');
      $('#custom-question-form').reset();
      $('#cq-options-wrap').hidden = true;
    } catch (err) { console.error(err); toast('Errore salvataggio: ' + err.message, true); }
    finally { setBusy(false); }
  }

  async function deleteCustomQuestion(id) {
    const q = customQuestions.find(x => x.id === id);
    const okDel = await confirmAction('Eliminare la domanda?',
      `"${q && q.text}" non sarà più mostrata nel modulo di richiesta.`);
    if (!okDel) return;
    setBusy(true);
    try {
      await fsDelete(CQ_COL, id);
      // rimuovi il riferimento dai pacchetti
      const remaining = await fsGetAll(CQ_COL);
      customQuestions = remaining;
      renderCustomQuestions();
      toast('Domanda eliminata dal modulo.');
    } catch (err) { console.error(err); toast('Errore eliminazione: ' + err.message, true); }
    finally { setBusy(false); }
  }

  async function toggleCustomRequired(id) {
    const q = customQuestions.find(x => x.id === id);
    if (!q) return;
    setBusy(true);
    try {
      await fsSet(CQ_COL, id, { required: !q.required });
      q.required = !q.required;
      renderCustomQuestions();
      toast(q.required ? 'Domanda resa obbligatoria.' : 'Domanda resa facoltativa.');
    } catch (err) { console.error(err); }
    finally { setBusy(false); }
  }

  function initServicesSection() {
    resetPackageForm();
    $('#package-form').addEventListener('submit', savePackage);
    $('#pkg-cancel-edit').addEventListener('click', () => { $('#pkg-key').disabled = false; resetPackageForm(); });
    $('#custom-question-form').addEventListener('submit', addCustomQuestion);
    $('#cq-type').addEventListener('change', () => {
      const needsOpts = ['multiple', 'checkbox'].includes($('#cq-type').value);
      $('#cq-options-wrap').hidden = !needsOpts;
      $('#cq-options').required = needsOpts;
    });
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
    $('#custom-questions-list').addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.cqDel) deleteCustomQuestion(t.dataset.cqDel);
      else if (t.dataset.cqToggleReq) toggleCustomRequired(t.dataset.cqToggleReq);
    });
    // collega/scollega una domanda personalizzata a un singolo pacchetto
    $('#custom-questions-list').addEventListener('change', async (e) => {
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
      } catch (err) { console.error(err); toast('Errore collegamento: ' + err.message, true); }
      finally { setBusy(false); }
    });
    loadServices();
  }

  /* ========================= NAVIGATION ======================== */
  function switchPanel(name) {
    $$('.side-btn').forEach(b => b.classList.toggle('active', b.dataset.panel === name));
    $$('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + name));
  }

  /* ===================== ANTEPRIMA LIVE (destra) ==================
     Ricrea in miniatura ciò che la Home pubblica mostra: recensioni,
     pacchetti attivi/visibili e domande attive del test. I colori dei
     pacchetti seguono il tema corrente (applyPreviewTheme).            */
  /* Card recensione fedele alla Home (.testimonial-card-inner di style.css):
     sfondo avorio/tema, stelle ambra centrate in alto, testo corsivo centrato,
     nome e data in basso. Usata sia nella sezione "Recensioni" dell'anteprima
     sia nella miniatura della Home. */
  function pvReviewCardHtml(r) {
    const stars = Math.min(5, Math.max(0, Number(r.stars) || 0));
    return `
      <div class="pv-tcard">
        <div class="pv-tstars">${'<i class="fa-solid fa-star"></i>'.repeat(stars)}${'<i class="fa-regular fa-star"></i>'.repeat(5 - stars)}</div>
        <p class="pv-ttext">${esc(r.description || '')}</p>
        <div class="pv-tfoot">
          <strong>${esc(reviewDisplayName(r))}</strong>
          <span>${esc(fmtDateIT(r.date))}</span>
        </div>
      </div>`;
  }

  function renderLivePreview() {
    // Dopo un salvataggio o un refresh, la "bozza" non serve più: il contenuto
    // reale compare già nella lista sottostante.
    renderDraftsCleared();
    // --- Recensioni (card identiche alla Home, ordinate per data) ---
    const revBox = $('#pv-reviews');
    if (revBox) {
      const sorted = [...allReviews].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
      revBox.innerHTML = sorted.length
        ? `<div class="pv-tcards">${sorted.map(pvReviewCardHtml).join('')}</div>`
        : '<p class="pv-empty">Nessuna recensione nel database. Aggiungine una dalla sezione Recensioni: comparirà qui e nella Home.</p>';
    }
    // --- Pacchetti attivi e visibili nella Home (stile identico alla Home) ---
    const pkgBox = $('#pv-packages');
    if (pkgBox) {
      const visible = pkgSorted().filter(p => p.active !== false && p.showInHome !== false);
      pkgBox.innerHTML = visible.length
        ? visible.map((p, i) => pvServiceCardHtml(p, p.featured || p.key === 'piano-autonomo')).join('')
        : '<p class="pv-empty">Nessun pacchetto attivo e visibile nella Home.</p>';
    }
    // --- Domande attive del test, in ordine ---
    const quizBox = $('#pv-quiz');
    if (quizBox) {
      const qs = sortedQuestions();
      quizBox.innerHTML = qs.length
        ? qs.map((q, i) => `
          <div class="pv-q${q.active === false ? ' off' : ''}">
            <span class="pv-num">${i + 1}.</span>
            <span>${esc(q.text)} <em style="color:#98917f;">(${(q.answers || []).length} risposte)</em></span>
          </div>`).join('')
        : '<p class="pv-empty">Nessuna domanda nel database.</p>';
    }
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
  const DRAFT_REV_IDS   = ['#rev-name', '#rev-initial', '#rev-text', '#rev-date'];
  const DRAFT_Q_IDS     = ['#q-text'];
  const DRAFT_PKG_IDS   = ['#pkg-name', '#pkg-type', '#pkg-price', '#pkg-desc', '#pkg-features'];
  const DRAFT_CQ_IDS    = ['#cq-text', '#cq-type', '#cq-options', '#cq-required'];

  function draftReviewHtml() {
    const name = ($('#rev-name').value || '').trim();
    const ini  = ($('#rev-initial').value || '').trim().toUpperCase();
    const desc = ($('#rev-text').value || '').trim();
    const date = ($('#rev-date').value || '').trim();
    if (!name && !ini && !desc) return '';
    // Card identica alla Home, marcata come "bozza"
    return `<div class="pv-tcards"><div class="pv-draft-wrap">${pvReviewCardHtml({
      name: name || 'Nome', initial: ini, stars: currentStarRating(),
      description: desc || 'La recensione comparirà qui mentre scrivi…',
      date: date || new Date().toISOString().slice(0, 10)
    })}</div></div>`;
  }

  function draftQuestionHtml() {
    const text = ($('#q-text').value || '').trim();
    if (!text) return '';
    const opts = $$('#options-editor .opt-row')
      .map(r => r.querySelector('[data-opt-text]').value.trim()).filter(Boolean);
    const nextNum = sortedQuestions().length + 1;
    return `
      <div class="pv-q pv-draft" style="display:block;">
        <div><span class="pv-num">${nextNum}.</span> <strong>${esc(text)}</strong></div>
        ${opts.length ? `<ul style="margin:4px 0 0 26px;font-size:11.5px;color:#6b6557;">${opts.map(o => `<li>${esc(o)}</li>`).join('')}</ul>` : '<div style="font-size:11px;color:#98917f;margin-top:3px;margin-left:26px;">Ancora nessuna risposta</div>'}
      </div>`;
  }

  function draftPackageHtml() {
    const name  = ($('#pkg-name').value || '').trim();
    const type  = ($('#pkg-type').value || '').trim();
    const price = ($('#pkg-price').value || '').trim();
    const desc  = ($('#pkg-desc').value || '').trim();
    const feats = ($('#pkg-features').value || '').split('\n').map(s => s.trim()).filter(Boolean);
    if (!name && !type && !price && !desc) return '';
    // Stile identico alla card servizio della Home (vedi pvServiceCardHtml)
    const featured = /piano|completo/i.test(name + ' ' + type);
    const btnLabel = featured ? 'Acquista il piano' : (/online/i.test(type + ' ' + name) ? 'Prenota online' : /gruppo/i.test(type + ' ' + name) ? "Lista d'interesse" : 'Prenota in studio');
    return `
      <div class="pv-service-card pv-draft${featured ? ' featured' : ''}">
        ${featured ? '<span class="pv-service-tag">Il più completo</span>' : ''}
        <h3><span class="pv-title-icon"><i class="fa-solid fa-briefcase"></i></span> ${esc(name) || '<em style="opacity:.6;">Nome pacchetto…</em>'}</h3>
        ${price ? `<div class="pv-service-price">${esc(price)}</div>` : ''}
        ${feats.length ? `<ul>${feats.slice(0, 5).map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : `<p class="pv-pdesc" style="margin-top:6px;">${esc(desc) || '<em style="opacity:.6;">Descrizione…</em>'}</p>`}
        <span class="pv-hbtn ${featured ? 'pv-hbtn--forest' : 'pv-hbtn--sage'}">${btnLabel}</span>
      </div>`;
  }

  function draftCustomQuestionHtml() {
    const text = ($('#cq-text').value || '').trim();
    if (!text) return '';
    const typeSel = $('#cq-type');
    const typeLabel = typeSel.options[typeSel.selectedIndex].text;
    const required = $('#cq-required').checked;
    const options = ($('#cq-options').value || '').split(',').map(s => s.trim()).filter(Boolean);
    let field = '';
    if (typeSel.value === 'long') field = '<textarea rows="2" disabled placeholder="Risposta lunga…" style="width:100%;border:1px solid #ddd6c6;border-radius:8px;padding:6px 8px;font-size:11.5px;"></textarea>';
    else if (typeSel.value === 'multiple') field = options.map(o => `<label style="display:block;font-size:11.5px;font-weight:400;"><input type="radio" disabled /> ${esc(o)}</label>`).join('');
    else if (typeSel.value === 'checkbox') field = options.map(o => `<label style="display:block;font-size:11.5px;font-weight:400;"><input type="checkbox" disabled /> ${esc(o)}</label>`).join('');
    else field = '<input type="text" disabled placeholder="Risposta breve…" style="width:100%;border:1px solid #ddd6c6;border-radius:8px;padding:6px 8px;font-size:11.5px;" />';
    return `
      <div class="pv-draft" style="padding:10px 12px;border-radius:10px;background:#fff;">
        <div style="font-size:12.5px;font-weight:600;color:var(--antracite);">${esc(text)}${required ? ' <span style="color:#c0392b;">*</span>' : ''}</div>
        <div style="font-size:10.5px;color:#98917f;margin-bottom:6px;">${esc(typeLabel)} · ${required ? 'obbligatoria' : 'facoltativa'}</div>
        ${field}
      </div>`;
  }

  function renderDrafts() {
    const d1 = $('#pv-draft-review');   if (d1) d1.innerHTML = draftReviewHtml();
    const d2 = $('#pv-draft-question'); if (d2) d2.innerHTML = draftQuestionHtml();
    const d3 = $('#pv-draft-package');  if (d3) d3.innerHTML = draftPackageHtml();
    const d4 = $('#pv-draft-cq');       if (d4) d4.innerHTML = draftCustomQuestionHtml();
    // La miniatura della Home segue la bozza del pacchetto mentre si scrive
    renderMiniHome();
  }

  // Svuota gli slot "bozza" (usato dopo un salvataggio: il dato reale entra nelle liste).
  function renderDraftsCleared() {
    ['#pv-draft-review', '#pv-draft-question', '#pv-draft-package', '#pv-draft-cq']
      .forEach(sel => { const el = $(sel); if (el) el.innerHTML = ''; });
  }

  let draftTimer = null;
  function scheduleDraftRender() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(renderDrafts, 120);
  }

  function initDraftLivePreview() {
    [...DRAFT_REV_IDS, ...DRAFT_Q_IDS, ...DRAFT_PKG_IDS, ...DRAFT_CQ_IDS].forEach(sel => {
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
    box.innerHTML = defs.map(d => d.group
      ? `<div class="color-group-title">${esc(d.group)}</div>`
      : `<div class="color-row">
           <label class="cl" for="tc-${d.key}">${esc(d.label)}</label>
           <input type="color" id="tc-${d.key}" data-tkey="${d.key}" value="${hexToCss(currentTheme[d.key], THEME_DEFAULTS[d.key])}" />
           <span class="hexv" id="hv-${d.key}">${hexToCss(currentTheme[d.key], THEME_DEFAULTS[d.key])}</span>
         </div>`).join('');
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
        <h3><span class="pv-title-icon"><i class="fa-solid ${icon}"></i></span> ${esc(p.name)}</h3>
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
        <h4>P.E.R.S.M.A.R.T.: sei fasi per arrivare dove vuoi.</h4>
      </div>
      <div class="pv-mini-section pv-mini-testi">
        <span class="pv-mini-kicker">Recensioni</span>
        <h4>Cosa dicono di me.</h4>
        ${(() => {
          const sorted = [...allReviews].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
          const r = sorted[0];
          return r ? `<div class="pv-tcards mini">${pvReviewCardHtml({ ...r, description: (r.description || '').slice(0, 160) + ((r.description || '').length > 160 ? '…' : '') })}</div>`
                   : '<p class="pv-empty">Nessuna recensione nel database.</p>';
        })()}
      </div>
      <div class="pv-mini-section pv-mini-faq">
        <span class="pv-mini-kicker">FAQ</span>
        <h4>Le risposte che cercavi.</h4>
      </div>
      <div class="pv-mini-footer">
        <strong>Valeria Moretti</strong> · Mental Coach — sito realizzato da webnix
      </div>`;
  }

  function onThemePickerChange(e) {
    const inp = e.target.closest('input[type="color"][data-tkey]');
    if (!inp) return;
    const k = inp.dataset.tkey;
    currentTheme[k] = inp.value;
    const hv = $('#hv-' + k);
    if (hv) hv.textContent = inp.value;
    applyPreviewTheme(currentTheme);
  }

  async function loadTheme() {
    setBusy(true);
    try {
      const ref = FB.doc(FB.db, THEME_COL, THEME_DOC);
      const snap = await FB.getDoc(ref);
      if (snap.exists()) currentTheme = { ...THEME_DEFAULTS, ...(snap.data() || {}) };
    } catch (err) {
      console.warn('Tema non caricato (uso default):', err);
    } finally { setBusy(false); }
    buildColorRows('#theme-sections-grid', THEME_SECTIONS);
    buildColorRows('#theme-buttons-grid', THEME_BUTTONS);
    applyPreviewTheme(currentTheme);
  }

  async function saveTheme() {
    setBusy(true);
    try {
      await FB.setDoc(FB.doc(FB.db, THEME_COL, THEME_DOC), { ...currentTheme, updatedAt: new Date().toISOString() });
      toast('Colori salvati: la Home li applica al prossimo caricamento.');
    } catch (err) {
      console.error(err);
      toast('Errore salvataggio colori: ' + err.message, true);
    } finally { setBusy(false); }
  }

  function initThemeSection() {
    buildColorRows('#theme-sections-grid', THEME_SECTIONS);
    buildColorRows('#theme-buttons-grid', THEME_BUTTONS);
    const grid1 = $('#theme-sections-grid'), grid2 = $('#theme-buttons-grid');
    [grid1, grid2].forEach(g => g && g.addEventListener('input', onThemePickerChange));
    $('#btn-theme-save').addEventListener('click', saveTheme);
    $('#btn-theme-reset').addEventListener('click', () => {
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
    { sel: '.side-brand', title: 'Benvenuto!', text: 'Questa è la dashboard privata di Valeria Moretti. Si accede solo con l\'account Google autorizzato e tutto ciò che salvi qui si riflette subito sul sito pubblico.' },
    { sel: '[data-panel="recensioni"]', title: '1 · Recensioni', text: 'Prima sezione: aggiungi, modifica, cerca ed elimina le recensioni pubblicate nella Home («Cosa dicono di me»). Cliccala per aprire il pannello.' },
    { sel: '#rev-name', title: 'Compila la recensione', text: 'Inserisci Nome e iniziale del cognome (una sola lettera). Man mano che scrivi, l\'anteprima live a destra ti mostra la recensione già composta.' },
    { sel: '#rev-star-rating', title: 'Le stelle', text: 'Passa il mouse sulle stelle: si animano in giallo con ombra. Clicca il numero desiderato da 1 a 5 — la selezione parte sempre da sinistra verso destra.' },
    { sel: '#review-form .btn--primary', title: 'Salva recensione', text: 'Con questo pulsante la recensione va nel database e appare automaticamente nella Home, senza toccare il codice.' },
    { sel: '#rev-search', title: 'Cerca', text: 'Digita un nome o anche solo un\'iniziale: la tabella sotto si filtra istantaneamente mentre scrivi.' },
    { sel: '[data-panel="test"]', title: '2 · Test gratuito', text: 'Qui gestisci il questionario online: crea domande, modifica le risposte, riordina con ↑ ↓, attiva o disattiva ogni domanda. Tutto compare nel popup del test in Home.' },
    { sel: '[data-panel="servizi"]', title: '3 · Servizi e pacchetti', text: 'Aggiungi o rimuovi pacchetti, imposti prezzo e descrizione, decidi quali mostrare nella Home, crea le domande personalizzate del modulo di richiesta e consulta le richieste dei visitatori.' },
    { sel: '[data-panel="colori"]', title: '4 · Colori & stile', text: 'Cambia sfondi, testi e bottoni del sito pubblico, sezione per sezione. L\'anteprima a destra replica esattamente lo stile della Home mentre modifichi.' },
    { sel: '#preview-pane', title: 'Anteprima live', text: 'Questa colonna mostra in tempo reale cosa vedranno i visitatori: recensioni, pacchetti, domande e mini-Home. Il pulsante Aggiorna rilegge il database.' },
    { sel: '.side-user', title: 'Sei pronta!', text: 'Da qui puoi uscire con "Esci". Riprendi questo tutorial quando vuoi dal pulsante Tutorial, e leggi tutte le spiegazioni dettagliate nel pulsante Istruzioni. Buon lavoro! ✨' },
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
    const panel = el.closest('.panel');
    if (panel && !panel.classList.contains('active')) {
      const btn = document.querySelector(`.side-btn[data-panel="${panel.id.replace('panel-', '')}"]`);
      if (btn) switchPanel(btn.dataset.panel);
    }
  }

  function tourPlace(i) {
    const step = TOUR_STEPS[i];
    tourEnsurePanel(step.sel);
    requestAnimationFrame(() => {
      let el = tourVisible(step.sel);
      if (!el) { // fallback: evidenzia la sidebar / centro schermo
        el = document.querySelector('.sidebar') || document.body;
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        const r = el.getBoundingClientRect();
        const pad = 6;
        const hole = tourEls.hole;
        hole.setAttribute('x', Math.max(0, r.left - pad));
        hole.setAttribute('y', Math.max(0, r.top - pad));
        hole.setAttribute('width', Math.min(window.innerWidth, r.width + pad * 2));
        hole.setAttribute('height', Math.min(window.innerHeight, r.height + pad * 2));
        // posizione card: sotto l'elemento se c'è spazio, altrimenti sopra/destra
        const card = tourEls.card;
        const cw = card.offsetWidth, ch = card.offsetHeight;
        let left = r.left, top = r.bottom + 14;
        if (top + ch > window.innerHeight - 12) top = Math.max(12, r.top - ch - 14);
        if (top < 12) { left = r.right + 14; top = Math.max(12, Math.min(r.top, window.innerHeight - ch - 12)); }
        if (left + cw > window.innerWidth - 12) left = window.innerWidth - cw - 12;
        if (left < 12) left = 12;
        card.style.left = left + 'px';
        card.style.top = top + 'px';
      }, 260);
      tourEls.counter.textContent = `Passaggio ${i + 1} / ${TOUR_STEPS.length}`;
      tourEls.title.textContent = step.title;
      tourEls.text.textContent = step.text;
      tourEls.prev.hidden = i === 0;
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
    tourEls.title = $('#tour-title');
    tourEls.text = $('#tour-text');
    tourEls.prev = $('#tour-prev');
    tourEls.next = $('#tour-next');
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
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeHelp(); if (tourIdx >= 0) stopTour(); }
    });
    window.addEventListener('resize', () => { if (tourIdx >= 0) tourPlace(tourIdx); });
  }

  /* =========================== BOOTSTRAP ======================== */
  let dashInited = false;
  function initDashboard() {
    if (dashInited) return;
    dashInited = true;
    $$('.side-btn').forEach(b => b.addEventListener('click', () => switchPanel(b.dataset.panel)));
    initReviewsSection();
    initQuizSection();
    initServicesSection();
    initThemeSection();
    initHelpSection(); // bottoni Istruzioni + Tutorial con tour interattivo spotlight
    initDraftLivePreview(); // anteprima live si aggiorna mentre scrivi nei form
    // Anteprima live: aggiorna anche manualmente
    const rb = $('#btn-preview-refresh');
    if (rb) rb.addEventListener('click', () => {
      loadReviews(); loadQuiz(); loadServices();
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
