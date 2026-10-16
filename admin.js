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
      renderReviewsTable();
    } catch (e) {
      console.error(e); toast('Errore caricamento recensioni: ' + e.message, true);
    } finally { setBusy(false); }
  }

  function resetReviewForm() {
    $('#review-form').reset();
    $('#rev-edit-id').value = '';
    $('#rev-form-title').textContent = 'Aggiungi una recensione';
    $('#rev-cancel-edit').hidden = true;
    const today = new Date().toISOString().slice(0, 10);
    $('#rev-date').value = today;
  }

  function fillReviewForm(r) {
    $('#rev-edit-id').value = r.id;
    $('#rev-name').value = r.name || '';
    $('#rev-initial').value = (r.initial || '').toUpperCase();
    $('#rev-stars').value = String(r.stars || 5);
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
      stars: Number($('#rev-stars').value),
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
      renderQuestionsList();
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
      renderQuestionsList();
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
      renderQuestionsList();
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
      renderQuestionsList();
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
      renderQuestionsList();
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
      renderQuestionsList();
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
      renderPackages(); renderCustomQuestions(); renderRequests();
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
      renderPackages();
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

  function fillPackageForm(p) {
    $('#pkg-edit-key').value = p.id;
    $('#pkg-key').value = p.key || p.id;
    $('#pkg-key').disabled = true;
    $('#pkg-name').value = p.name || '';
    $('#pkg-type').value = p.type || '';
    $('#pkg-price').value = p.price || '';
    $('#pkg-desc').value = p.desc || '';
    $('#pkg-features').value = (p.features || []).join('\n');
    $('#pkg-active').checked = p.active !== false;
    $('#pkg-visible').checked = p.showInHome !== false;
    $('#pkg-form-title').textContent = 'Modifica pacchetto: ' + p.name;
    $('#pkg-cancel-edit').hidden = false;
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
      active: $('#pkg-active').checked,
      showInHome: $('#pkg-visible').checked,
      questionKeys: existing ? (existing.questionKeys || []) : [],
      order: existing ? Number(existing.order) : (pkgSorted().length + 1)
    };
    setBusy(true);
    try {
      await fsSet(PKG_COL, editId || ('pkg-' + key), data);
      toast('Pacchetto salvato: aggiornato nella Home e nel popup.');
      $('#pkg-key').disabled = false;
      resetPackageForm();
      packages = await fsGetAll(PKG_COL);
      renderPackages();
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
      renderPackages();
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
      renderPackages();
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
      renderPackages();
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
      if (t.dataset.pkgEdit) { const p = packages.find(x => x.id === t.dataset.pkgEdit); if (p) fillPackageForm(p); }
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
        renderPackages();
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

  /* =========================== BOOTSTRAP ======================== */
  let dashInited = false;
  function initDashboard() {
    if (dashInited) return;
    dashInited = true;
    $$('.side-btn').forEach(b => b.addEventListener('click', () => switchPanel(b.dataset.panel)));
    initReviewsSection();
    initQuizSection();
    initServicesSection();
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
