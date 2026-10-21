/* ============================================================
   main.js — Valeria Moretti — Mental Coach
   Unificato: Preloader, Nav, Reveal, Cookie, Modali, Firebase, Quiz, Contatti
   ============================================================ */

(function () {
  'use strict';

  // ============================================
  // 1. GLOBAL VARIABLES & DEFAULT DATA
  // ============================================
  let activeModal = null;
  let contactFormTemplateId = 'template_86ls76q';
  let quizCurrentStep = 0;
  let quizScores = { A: 0, B: 0, C: 0, D: 0 };
  let quizFinalProfile = '';
  let quizFinalProfileTitle = '';
  let contactCurrentStep = 1;
  // Step fissi del modulo contatto: nome, cognome, email, telefono, messaggio, servizio, privacy
  let contactFixedSteps = 7;
  let contactTotalSteps = contactFixedSteps;
  let selectedServiceName = '';

  const defaultQuizQuestions = [
    { id: 1, text: "Quando ricevi un messaggio dalla persona che stai frequentando:", options: [
      { text: "Rispondo quasi subito: mi piace far sentire la mia presenza e disponibilità.", score: "A" },
      { text: "Rispondo con entusiasmo: ogni messaggio mi fa sognare un po' di più il nostro futuro.", score: "B" },
      { text: "Rispondo con calma: preferisco non sembrare troppo pressante e mantenere i miei spazi.", score: "C" },
      { text: "Controllo l'ora dell'ultimo accesso: cerco di capire quanto ci ha messo a scrivermi.", score: "D" }
    ]},
    { id: 2, text: "Ti propone un appuntamento, ma avevi già un impegno con un'amica:", options: [
      { text: "Cerco di spostare l'impegno con l'amica: non voglio perdere l'occasione di vederlo/a.", score: "A" },
      { text: "Accetto subito: l'adrenalina dell'incontro vince su tutto il resto.", score: "B" },
      { text: "Propongo un altro giorno: tengo molto alla mia routine e ai miei impegni precedenti.", score: "C" },
      { text: "Accetto, ma poi passo il tempo a chiedermi se l'ha fatto solo perché non aveva altro da fare.", score: "D" }
    ]},
    { id: 3, text: "Cosa cerchi di più in un partner?", options: [
      { text: "Qualcuno che sappia apprezzare tutto l'amore e le attenzioni che so dare.", score: "A" },
      { text: "Una connessione magica, di quelle che si leggono nei libri o si vedono nei film.", score: "B" },
      { text: "Una persona autonoma che rispetti la mia indipendenza senza troppe pretese.", score: "C" },
      { text: "Una presenza costante che mi faccia sentire al sicuro e mai in dubbio.", score: "D" }
    ]},
    { id: 4, text: "Durante i primi mesi, se sorge un piccolo malinteso:", options: [
      { text: "Chiedo scusa o cerco di 'lasciar passare': l'importante è che torni l'armonia il prima possibile.", score: "A" },
      { text: "Mi abbatto un po': temo che la 'scintilla' iniziale si stia già spegnendo.", score: "B" },
      { text: "Mi distacco per un paio di giorni: ho bisogno di riflettere da solo/a senza pressioni.", score: "C" },
      { text: "Ho bisogno di parlarne subito: bisogna chiarire all'istante.", score: "D" }
    ]},
    { id: 5, text: "Sabato sera ideale con il partner:", options: [
      { text: "'Decidi tu, a me va bene tutto ciò che rende felice te'.", score: "A" },
      { text: "Qualcosa di nuovo e speciale: ogni uscita deve essere un'esperienza indimenticabile.", score: "B" },
      { text: "Una serata tranquilla, ma magari ognuno legge il suo libro o fa le sue cose nella stessa stanza.", score: "C" },
      { text: "Fare qualcosa insieme dove possiamo parlare e sentirci davvero vicini.", score: "D" }
    ]},
    { id: 6, text: "Se il partner non ti scrive per un intero pomeriggio:", options: [
      { text: "Penso che sia molto impegnato e gli mando un messaggino dolce per fargli sapere che ci sono.", score: "A" },
      { text: "Inizio a chiedermi se sta scemando l'interesse dei primi tempi.", score: "B" },
      { text: "Non ci faccio quasi caso: anche io sono concentrato/a sulle mie attività.", score: "C" },
      { text: "Mi chiedo cosa stia facendo e perché non trovi nemmeno un minuto per un saluto.", score: "D" }
    ]},
    { id: 7, text: "Come ti descriveresti all'inizio di una storia?", options: [
      { text: "Molto generoso/a: amo prendermi cura dell'altro in ogni dettaglio.", score: "A" },
      { text: "Un sognatore/trice: mi lascio trasportare dalle emozioni senza freni.", score: "B" },
      { text: "Prudente: ci metto un po' a lasciarmi andare del tutto.", score: "C" },
      { text: "Attento/a: osservo ogni segnale per capire se posso fidarmi davvero.", score: "D" }
    ]},
    { id: 8, text: "Quando si parla di progetti futuri (anche piccoli):", options: [
      { text: "Mi adatto volentieri ai suoi sogni, sono felice di farne parte.", score: "A" },
      { text: "Adoro pianificare: immagino già i viaggi e le tappe importanti che faremo.", score: "B" },
      { text: "Preferisco vivere il presente, fare piani a lungo termine mi mette un po' d'ansia.", score: "C" },
      { text: "Cerco conferme sul fatto che saremo ancora insieme tra un anno.", score: "D" }
    ]},
    { id: 9, text: "In una relazione, qual è la tua paura più grande?", options: [
      { text: "Che l'altro smetta di aver bisogno di me o non apprezzi i miei sforzi.", score: "A" },
      { text: "Che la quotidianità diventi noiosa e si perda la passione.", score: "B" },
      { text: "Di sentirmi soffocare o di dover rinunciare alla mia libertà.", score: "C" },
      { text: "Di essere lasciato/a all'improvviso o tradito/a.", score: "D" }
    ]},
    { id: 10, text: "Cosa pensi dei tuoi 'errori' passati in amore?", options: [
      { text: "Forse ho dato troppo a persone che non lo meritavano.", score: "A" },
      { text: "Ho creduto troppo presto in storie che poi si sono rivelate diverse.", score: "B" },
      { text: "Forse ho tenuto le persone troppo a distanza per paura di soffrire.", score: "C" },
      { text: "Sono stato/a troppo attento/a ai dettagli, rovinando il clima con i miei dubbi.", score: "D" }
    ]}
  ];

  const defaultQuizResults = {
    A: { title: "L'Anima Generosa", subtitle: "Il 'Sempre Disponibile'", description: "Ti prendi cura degli altri con una naturalezza disarmante.", analysis: "✨ I TUOI PUNTI DI FORZA\n• Empatia profonda: senti i bisogni dell'altro prima ancora che vengano espressi\n• Affidabilità: sei una roccia, la tua presenza è costante e rassicurante\n• Generosità emotiva: chi sta con te si sente inizialmente molto coccolato e al centro del mondo\n\n⚠️ I TUOI PUNTI DI DEBOLEZZA\n• Difficoltà nei confini: fai fatica a dire 'no' per paura di deludere o creare conflitto\n• Scomparsa del sé: tendi a mettere i tuoi hobby, amici e bisogni in secondo piano\n• Resentimento silenzioso: accumuli stanchezza nel 'dare sempre'\n\n🚩 PERCHÉ QUESTO INFLUISCE SULLE TUE STORIE\n🔹 In Frequentazione: essere 'troppo disponibile' toglie quel pizzico di mistero e di conquista.\n🔹 In Relazione: si crea uno squilibrio di potere. Tu diventi il 'genitore' o l'assistente.\n\n💡 IL CONSIGLIO DELLA TUA CONSULENTE\nLa tua disponibilità è un dono prezioso, ma non è una moneta di scambio per ottenere amore. Imparare a farsi attendere e a coltivare i propri spazi non ti rende meno 'buona/o', ma ti rende incredibilmente più magnetica/o." },
    B: { title: "L'Idealista Sognatore", subtitle: "Il 'Velocista dell'Amore'", description: "Ti lasci trasportare dalle emozioni senza freni.", analysis: "✨ I TUOI PUNTI DI FORZA\n• Entusiasmo contagioso: porti gioia e vitalità in ogni nuova conoscenza\n• Ottimismo sentimentale: nonostante le delusioni, continui a credere nel grande amore\n• Capacità di sognare: sai progettare, immaginare e creare connessioni emotive profonde\n\n⚠️ I TUOI PUNTI DI DEBOLEZZA\n• Aspettative altissime: cerchi la 'perfezione' o il segnale del destino\n• Cecità selettiva: nella fretta di vivere il sogno, tendi a ignorare i red flags\n• Difficoltà con la routine: quando finisce l'euforia iniziale, la quotidianità ti sembra una sconfitta\n\n🚩 PERCHÉ QUESTO INFLUISCE SULLE TUE STORIE\n🔹 In Frequentazione: tendi a 'bruciare le tappe'. Spesso spaventi l'altro con un'intensità eccessiva.\n🔹 In Relazione: appena subentrano i primi problemi reali o la noia, senti che la magia è finita.\n\n💡 IL CONSIGLIO DELLA TUA CONSULENTE\nSognare in grande è il tuo dono, ma un amore che dura ha bisogno di radici, non solo di ali. Impara a goderti la lentezza: conoscere qualcuno per chi è davvero (con i suoi difetti) è molto più gratificante che amare un'immagine perfetta." },
    C: { title: "L'Indipendente Solitario", subtitle: "La 'Fortezza Inespugnabile'", description: "Sei una persona solida e centrata, non cerchi un partner perché 'ti manca un pezzo'.", analysis: "✨ I TUOI PUNTI DI FORZA\n• Autonomia: sei una persona solida e centrata\n• Razionalità: sai gestire le crisi con lucidità, senza lasciarti travolgere dai drammi emotivi\n• Rispetto degli spazi: non soffochi mai il partner e rispetti profondamente la sua individualità\n\n⚠️ I TUOI PUNTI DI DEBOLEZZA\n• Paura della vulnerabilità: mostrare le tue fragilità ti fa sentire debole o in pericolo\n• Barriere emotive: quando senti che l'intimità sta diventando 'troppa', tendi a ritirarti\n• Difficoltà di impegno: l'idea di fare progetti a lungo termine ti fa sentire un senso di claustrofobia\n\n🚩 PERCHÉ QUESTO INFLUISCE SULLE TUE STORIE\n🔹 In Frequentazione: all'inizio risulti affascinante e misterioso/a, ma non appena l'altro cerca di fare un passo avanti, tu ne fai due indietro.\n🔹 In Relazione: tendi a vivere come 'un single in coppia'. Escludi il partner dalle tue decisioni.\n\n💡 IL CONSIGLIO DELLA TUA CONSULENTE\nL'indipendenza è una virtù, ma l'autosufficienza estrema è spesso una corazza per non soffrire. Ricorda che permettere a qualcuno di avvicinarsi non significa perdere la tua libertà, ma raddoppiare la tua forza." },
    D: { title: "Il Ricercatore di Sicurezza", subtitle: "Il 'Vigile del Cuore'", description: "Credi nel valore della coppia come squadra, 'noi' viene prima di 'io'.", analysis: "✨ I TUOI PUNTI DI FORZA\n• Profonda lealtà: quando ti fidi, sei un partner di una fedeltà incrollabile\n• Attenzione ai dettagli: non ti sfugge nulla, sai cogliere un cambiamento d'umore nel partner\n• Desiderio di condivisione: credi nel valore della coppia come squadra\n\n⚠️ I TUOI PUNTI DI DEBOLEZZA\n• Bisogno di rassicurazione: se il partner non ti dà conferme costanti, entri subito in stato di allerta\n• Sovrappensiero (Overthinking): analizzi ogni virgola, ogni silenzio, cercando significati nascosti\n• Paura dell'abbandono: il timore che le cose possano finire ti impedisce di goderti il presente\n\n🚩 PERCHÉ QUESTO INFLUISCE SULLE TUE STORIE\n🔹 In Frequentazione: il tuo bisogno di sapere 'cosa siamo' troppo presto può mettere pressione all'altro.\n🔹 In Relazione: la tua ansia diventa un terzo incomodo. Il partner può sentirsi sotto esame.\n\n💡 IL CONSIGLIO DELLA TUA CONSULENTE\nLa sicurezza che cerchi all'esterno, negli occhi dell'altro, è una luce che devi prima accendere dentro di te. Imparare a tollerare l'incertezza non significa esporsi al pericolo, ma iniziare a fidarsi della propria capacità di gestire qualsiasi cosa accada." }
  };

  const defaultContactFields = [
    { id: 'challenge', type: 'textarea', label: 'Qual è la sfida più grande che stai affrontando nelle relazioni? *', placeholder: 'Descrivi brevemente la tua situazione...' },
    { id: 'readiness', type: 'scale', label: 'Quanto ti senti pronto/a a lavorare su te stesso/a? (1-10) *', scaleMin: 'Per niente', scaleMax: 'Completamente' }
  ];

  // 📦 Espone i dati predefiniti: servono alla dashboard admin per importare
  // il contenuto attuale del sito nel database al primo accesso (seed).
  window.__defaultQuizQuestions = defaultQuizQuestions;
  window.__defaultQuizResults = defaultQuizResults;
  window.__defaultServicePackages = [
    { key: 'piano-autonomo', type: 'Piano Digitale', title: 'Piano autonomo P.E.R.S.M.A.R.T.', price: '50 € una tantum', desc: 'Stai per acquistare il questionario approfondito e il piano personale scritto da Valeria. Verrai reindirizzato alla pagina di checkout sicuro.', features: ['Questionario approfondito (14 domande)', 'Piano personale scritto da Valeria', 'Consegna tramite email protetta'] },
    { key: 'sessione-studio', type: 'Sessione Individuale', title: 'Sessione in studio', price: '50 €/ora', desc: 'Stai per prenotare un incontro di 60 minuti nel mio studio a Valle Lomellina (PV). Verrai reindirizzato al calendario per scegliere data e ora.', features: ['Incontro individuale di 60 minuti', "Studio a Valle Lomellina (PV)", "Piano d'azione concordato"] },
    { key: 'sessione-online', type: 'Sessione Individuale', title: 'Sessione online', price: '50 €/ora', desc: 'Stai per prenotare un incontro di 60 minuti tramite videochiamata. Verrai reindirizzato al calendario per scegliere data e ora.', features: ['Videochiamata di 60 minuti', 'Da qualsiasi luogo', 'Stesso metodo, più flessibilità'] },
    { key: 'percorso-gruppo', type: 'Percorso di Gruppo', title: 'Percorsi di gruppo', price: 'Prossimo avvio', desc: "Lascia i tuoi dati per essere avvisato non appena si apriranno le iscrizioni al prossimo percorso di gruppo a numero chiuso.", features: ['Incontri guidati a numero chiuso', 'Obiettivi condivisi e supporto reciproco'] }
  ];
  const defaultConfig = {
    colors: { primary: '#591c2f', hover: '#451624', secondary: '#7FC8C8', bg: '#edddc8', text: '#2D2D2D', navbarBg: '#1c1c1c', navbarText: '#ffffff', footerBg: '#141414', footerText: '#a3a3a3' },
    general: { quizTitle: 'Scopri il tuo schema relazionale', pixelId: '', maintenanceMode: false },
    media: { carousel: ['https://raw.githubusercontent.com/mentalcoachvaleria-arch/Galleria-per-sito-web/main/1-fatto.png', 'https://raw.githubusercontent.com/mentalcoachvaleria-arch/Galleria-per-sito-web/main/3-fatto.png', 'https://raw.githubusercontent.com/mentalcoachvaleria-arch/Galleria-per-sito-web/main/2-fatto.png'], studioImage: 'https://raw.githubusercontent.com/mentalcoachvaleria-arch/Galleria-per-sito-web/main/3-fatto.png', problemVideoUrl: 'https://www.youtube.com/embed/Kdo6DryANfU' },
    social: { instagram: 'https://www.instagram.com/mentalcoachvaleria95', tiktok: 'https://www.tiktok.com/@mentalcoachvaleria95', youtube: 'https://www.youtube.com/@mentalcoachvaleria95', telegram: 'https://t.me/mentalcoachvaleria95', whatsapp: 'https://wa.me/393458407102', email: 'mentalcoachvaleria@gmail.com', phone: '+39 345 840 7102', address: 'Valle Lomellina, Pavia (PV), Italia' },
    // Elenco recensioni VUOTO di proposito: le recensioni provengono SOLO dal
    // database (Firestore, progetto mental-coach-2026) gestito dalla dashboard admin.
    // Non devono mai comparire dati statici/vecchi in attesa del caricamento del DB.
    reviews: { list: [] },
    quiz: { title: 'Test del Pattern Relazionale', questions: [], profiles: {} },
    contact: { sidebarTitle: 'Il cambiamento inizia con una parola.', sidebarList: 'Ascolto attivo\nRiservatezza\nApproccio personalizzato\nSpazio non giudicante', fields: [], successMessage: 'Grazie! La tua richiesta è stata inviata. Ti risponderemo entro 24h. Nel frattempo, respira. 🌿' }
  };

  // ============================================
  // 2. FIREBASE & DYNAMIC CONFIG HELPERS
  // ============================================
  function getQuizQuestions() { return window.dynamicQuizQuestions || defaultQuizQuestions; }
  function getQuizResults() { return window.dynamicQuizProfiles || defaultQuizResults; }
  function getContactFields() { return window.dynamicContactFields || defaultContactFields; }

  function deepMerge(target, source) {
    const output = { ...target };
    if (target && source && typeof target === 'object' && typeof source === 'object') {
      Object.keys(source).forEach(key => {
        if (Array.isArray(source[key])) output[key] = source[key];
        else if (typeof source[key] === 'object' && source[key] !== null) output[key] = deepMerge(target[key] || {}, source[key]);
        else output[key] = source[key];
      });
    }
    return output;
  }

  async function loadSiteConfigFromFirebase() {
    if (!window.firebaseDB || !window.firebaseDoc || !window.firebaseGetDoc) {
      console.warn('⚠️ Firebase non inizializzato, uso fallback');
      applyConfig(defaultConfig);
      return;
    }
    try {
      const docRef = window.firebaseDoc(window.firebaseDB, 'config', 'site_config');
      const docSnap = await window.firebaseGetDoc(docRef);
      const config = docSnap.exists() ? deepMerge(defaultConfig, docSnap.data()) : defaultConfig;
      applyConfig(config);
      console.log('✅ Configurazione caricata da Firebase');
      document.dispatchEvent(new CustomEvent('firebaseConfigReady', { detail: config }));
    } catch (error) {
      console.warn('⚠️ Errore Firebase, uso fallback', error);
      applyConfig(defaultConfig);
    }
  }
  // ============================================
  // 2b. CONTENUTI DINAMICI DAL DATABASE (dashboard admin)
  // Le raccolte Firestore gestite dalla dashboard:
  //   'reviews' → recensioni pubblicate nella Home
  //   'quiz_questions' → domande del test gratuito
  //   'service_packages' / 'service_form_questions' → pacchetti e modulo
  // Se una raccolta è vuota o non raggiungibile, il sito usa i contenuti statici.
  // ============================================
  async function fsGetAll(colName) {
    if (!window.firebaseDB || !window.firebaseCollection || !window.firebaseGetDocs) return [];
    const snap = await window.firebaseGetDocs(window.firebaseCollection(window.firebaseDB, colName));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  // Piccola utilità: attende che firebase-config.js (modulo ES asincrono) abbia
  // esposto le funzioni globali, così la Home non parte prima che Firebase sia pronto.
  function waitForFirebase(timeoutMs = 6000) {
    return new Promise((resolve) => {
      if (window.firebaseDB && window.firebaseCollection) return resolve(true);
      const start = Date.now();
      const iv = setInterval(() => {
        if (window.firebaseDB && window.firebaseCollection) { clearInterval(iv); resolve(true); }
        else if (Date.now() - start > timeoutMs) { clearInterval(iv); resolve(false); }
      }, 100);
    });
  }

  function mapReviewRows(rows) {
    return rows
      .slice()
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .map(r => ({ name: r.name + (r.initial ? ' ' + String(r.initial).toUpperCase() + '.' : ''), rating: Number(r.stars) || 5, date: fmtReviewDate(r.date), time: fmtReviewDate(r.date), text: r.description || '' }));
  }

  async function loadDynamicReviews() {
    await waitForFirebase();
    // 1) Primo caricamento classico (una tantum)
    let loaded = false;
    try {
      const rows = await fsGetAll('reviews');
      if (rows.length) {
        const list = mapReviewRows(rows);
        renderReviews(list);
        window.__testimonials = list.map(r => ({ name: r.name, text: r.text, time: r.date }));
        console.log('✅ Recensioni dinamiche caricate dal database:', list.length);
        loaded = true;
      }
    } catch (error) {
      console.warn('⚠️ Recensioni dinamiche non disponibili', error);
    }
    // 2) ASCOLTO LIVE: onSnapshot riaggiorna la Home automaticamente appena
    //    l'admin aggiunge/modifica/elimina una recensione. Niente refresh manuale.
    try {
      if (window.firebaseOnSnapshot && window.firebaseDB && window.firebaseCollection) {
        window.firebaseOnSnapshot(window.firebaseCollection(window.firebaseDB, 'reviews'), (snap) => {
          const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          if (!rows.length) return; // DB vuoto: lascia invariato ciò che è mostrato
          const list = mapReviewRows(rows);
          renderReviews(list);
          window.__testimonials = list.map(r => ({ name: r.name, text: r.text, time: r.date }));
          console.log('🔄 Recensioni aggiornate in tempo reale dal database:', list.length);
        }, (err) => console.warn('Ascolto recensioni non attivo:', err && err.message));
      }
    } catch (e) { console.warn('Ascolto recensioni non attivo:', e && e.message); }
    return loaded;
  }

  function fmtReviewDate(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
      return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { return iso; }
  }

  async function loadDynamicQuizForHome() {
    try {
      const rows = await fsGetAll('quiz_questions');
      const active = rows.filter(q => q.active !== false).sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
      if (!active.length) return;
      window.dynamicQuizQuestions = active.map((q, i) => ({
        id: q.id || i + 1, text: q.text,
        options: (q.answers || []).map(a => ({ text: a.text, score: a.profile }))
      }));
      console.log('✅ Domande test dinamiche caricate dal database:', active.length);
    } catch (error) {
      console.warn('⚠️ Domande test dinamiche non disponibili', error);
    }
  }

  // Pacchetti di default: se la dashboard non ha ancora popolato 'service_packages',
  // la Home mostra comunque i pacchetti standard e la tabella admin parte già piena.
  function defaultPackagesList() {
    return (window.__defaultServicePackages || []).map((p, i) => ({
      id: 'pkg-' + p.key, key: p.key, name: p.title, type: p.type, desc: p.desc,
      price: p.price || '', features: p.features || [],
      order: i + 1, active: true, showInHome: true, questionKeys: []
    }));
  }

  async function loadDynamicServices() {
    try {
      const [pkgsRaw, cqsRaw, cfgSnap] = await Promise.all([
        fsGetAll('service_packages'), fsGetAll('service_form_questions'),
        (window.firebaseDB && window.firebaseDoc && window.firebaseGetDoc)
          ? window.firebaseGetDoc(window.firebaseDoc(window.firebaseDB, 'config', 'site_config')).catch(() => null)
          : Promise.resolve(null)
      ]);
      // profili risultato / etichette del modulo dal documento config
      const svcCfg = cfgSnap && cfgSnap.exists ? cfgSnap.data() : null;
      if (svcCfg && svcCfg.quiz && svcCfg.quiz.profiles) {
        window.__dynamicConfig = Object.assign({}, window.__dynamicConfig || {}, { quiz: svcCfg.quiz });
      }
      if (svcCfg && svcCfg.services) {
        window.__dynamicServiceLabels = svcCfg.services;
      }
      const pkgs0 = pkgsRaw.filter(p => p.active !== false).sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
      // DB vuoto o non raggiungibile → usa i pacchetti standard del sito, così la
      // Home resta identica e la dashboard mostra comunque una tabella da cui
      // aggiungere/rimuovere/modificare i pacchetti.
      const pkgs = pkgs0.length ? pkgs0 : defaultPackagesList();
      if (!pkgs.length) return;
      const cqList = cqsRaw.filter(q => q.active !== false).sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
      window.__dynamicPackages = {};
      pkgs.forEach(p => { window.__dynamicPackages[p.key || p.id] = p; });
      window.__dynamicFormQuestions = cqList;
      renderDynamicServices(pkgs.filter(p => p.showInHome !== false));
      console.log('✅ Pacchetti dinamici caricati dal database:', pkgs.length);
    } catch (error) {
      console.warn('⚠️ Pacchetti dinamici non disponibili, uso contenuto statico', error);
      // Resilienza: anche se Firestore non risponde, mostra i pacchetti standard
      // in modalità dinamica — così i pulsanti «Prenota in studio / online»
      // aprono SEMPRE il popup con il modulo, come richiesto.
      try {
        const fallback = defaultPackagesList();
        if (fallback.length) {
          window.__dynamicPackages = {};
          fallback.forEach(p => { window.__dynamicPackages[p.key] = p; });
          renderDynamicServices(fallback);
        }
      } catch (e2) { console.warn('Fallback pacchetti non riuscito', e2); }
    }
  }

  function renderDynamicServices(visiblePkgs) {
    const grid = document.querySelector('#servizi .services-grid');
    if (!grid || !visiblePkgs.length) return;
    const icons = { 'Piano Digitale': 'fa-file-contract', 'Sessione Individuale': 'fa-location-dot', 'Percorso di Gruppo': 'fa-users' };
    grid.innerHTML = visiblePkgs.map((p, i) => {
      const feat = (p.features || []).map(f => '<li>' + escapeHtml(f) + '</li>').join('');
      const delay = i > 0 ? ' reveal-delay-' + Math.min(i, 3) : '';
      // evidenzia il pacchetto standard "Il più completo" anche in modalità dinamica
      const featured = p.featured || p.key === 'piano-autonomo' ? true : false;
      const icon = icons[p.type] || (p.key === 'sessione-online' ? 'fa-laptop' : 'fa-briefcase');
      const tagHtml = (p.tag || featured) ? '<span class="service-tag">' + escapeHtml(p.tag || 'Il più completo') + '</span>' : '';
      const priceHtml = p.price ? '<div class="service-price">' + escapeHtml(p.price) + '</div>' : '';
      const btnClass = 'btn btn--uiverse ' + (featured ? 'btn--forest' : 'btn--sage');
      // etichetta pulsante: quella impostata dalla dashboard, altrimenti una
      // sensata in base al tipo di pacchetto
      const rawLabel = p.buttonLabel || '';
      let defaultLabel = 'Richiedi il servizio';
      if (/prenota/i.test(rawLabel) || p.key === 'sessione-studio') defaultLabel = 'Prenota in studio';
      else if (p.key === 'sessione-online') defaultLabel = 'Prenota online';
      else if (p.key === 'percorso-gruppo') defaultLabel = 'Lista d\'interesse';
      else if (p.key === 'piano-autonomo') defaultLabel = 'Acquista il piano';
      const btnLabel = escapeHtml(rawLabel || defaultLabel);
      const pkgKey = escapeHtml(p.key || p.id);
      return '<div class="service-card' + (featured ? ' featured' : '') + ' reveal' + delay + '">' +
        tagHtml +
        '<h3><span class="service-title-icon"><i class="fa-solid ' + icon + '"></i></span> ' + escapeHtml(p.name) + '</h3>' +
        priceHtml +
        '<ul>' + feat + '</ul>' +
        '<button type="button" class="' + btnClass + '" data-service-modal="' + pkgKey + '">' + btnLabel + '</button>' +
        '</div>';
    }).join('');
    // riattiva listener mouse-hover sulle nuove card
    if (typeof initMobileHoverEffects === 'function') initMobileHoverEffects();
  }

  // (Non serve più riallacciare listener: gli onclick inline usano già
  // l'indice corretto della lista originale, vedi createCard/renderCards.)
  function initTestimonialsExpand() { /* no-op, mantenuto per compatibilità */ }
  // ============================================
  // 2c. PAGINA PUBBLICA test.html — domande, risposte e risultato dal database.
  // Le modifiche salvate nella dashboard (sezione Test gratuito) compaiono qui,
  // senza toccare il codice. Se il database non è raggiungibile o è vuoto,
  // la pagina conserva il suo contenuto statico originale.
  // ============================================
  async function loadDynamicTestPage() {
    const quizForm = document.getElementById('quiz-form');
    if (!quizForm) return; // non siamo sulla pagina del test
    try {
      const [rows, cfgSnap] = await Promise.all([
        fsGetAll('quiz_questions'),
        (window.firebaseDB && window.firebaseDoc && window.firebaseGetDoc)
          ? window.firebaseGetDoc(window.firebaseDoc(window.firebaseDB, 'config', 'site_config')).catch(() => null)
          : Promise.resolve(null)
      ]);
      const active = rows.filter(q => q.active !== false)
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
      const cfg = cfgSnap && cfgSnap.exists ? cfgSnap.data() : null;
      let changed = false;

      // Titolo del test (dashboard → Impostazioni rapide)
      const dynTitle = cfg && cfg.general && cfg.general.quizTitle;
      if (dynTitle) {
        const h1 = quizForm.querySelector('h1');
        const p = quizForm.querySelector('p');
        if (h1) h1.textContent = dynTitle;
        if (p) p.textContent = `${active.length || quizForm.querySelectorAll('[data-question-block]').length} domande · risultato immediato · zero costi`;
        changed = true;
      }

      // Domande e risposte dal database
      if (active.length) {
        quizForm.querySelectorAll('[data-question-block]').forEach(b => b.remove());
        const submitBtn = quizForm.querySelector('.quiz-submit-button');
        const letterMap = ['A', 'B', 'C', 'D', 'E'];
        active.forEach((q, idx) => {
          const blockEl = document.createElement('div');
          blockEl.className = 'question-block';
          blockEl.setAttribute('data-question-block', String(idx));
          let inner = `<h3>${idx + 1}. ${escapeHtml(q.text)}</h3>`;
          (q.answers || []).forEach((a, j) => {
            const letter = letterMap[j] || String.fromCharCode(65 + j);
            const inputId = `db-q${idx}-${letter}`;
            inner += `<div class="radio-card">` +
              `<input type="radio" id="${inputId}" name="question-${idx}" value="${escapeHtml(a.profile || 'A')}" required />` +
              `<label for="${inputId}"><span class="option-letter">${letter}</span><span class="option-text">${escapeHtml(a.text)}</span></label>` +
            `</div>`;
          });
          blockEl.innerHTML = inner;
          quizForm.insertBefore(blockEl, submitBtn);
        });
        if (typeof initRadioCards === 'function') initRadioCards();
        changed = true;
        console.log('✅ test.html: domande dinamiche dal database:', active.length);
      }

      // Profili/risultato personalizzabili dalla dashboard (config.quiz.profiles)
      if (cfg && cfg.quiz && cfg.quiz.profiles) {
        window.__dynamicConfig = Object.assign({}, window.__dynamicConfig || {}, { quiz: cfg.quiz });
      }
      if (changed) updateQuizProgressBar();
    } catch (err) {
      console.warn('⚠️ test.html: uso contenuto statico (database non disponibile)', err);
    }
  }
  function applyConfig(config) {
    window.__dynamicConfig = config;
    if (config.colors) {
      const root = document.documentElement;
      root.style.setProperty('--brand-primary', config.colors.primary);
      root.style.setProperty('--brand-primary-dark', config.colors.hover);
      root.style.setProperty('--brand-secondary', config.colors.secondary);
      root.style.setProperty('--brand-crema', config.colors.bg);
      root.style.setProperty('--brand-antracite', config.colors.text);
    }
    if (config.general?.pixelId) injectFacebookPixel(config.general.pixelId);
    if (config.quiz?.title) {
      const quizTitleEl = document.querySelector('#quiz h2, [data-quiz-title]');
      if (quizTitleEl) quizTitleEl.textContent = config.quiz.title;
    }
    if (config.quiz?.questions) {
      window.dynamicQuizQuestions = config.quiz.questions.map((q, i) => ({
        id: q.id || i + 1, text: q.text,
        options: q.answers?.map(a => ({ text: a.text, score: a.profile })) || []
      }));
    }
    if (config.quiz?.profiles) {
      window.dynamicQuizProfiles = {};
      ['A','B','C','D'].forEach(key => {
        const p = config.quiz.profiles[key];
        if (p) window.dynamicQuizProfiles[key] = { title: p.title || '', subtitle: p.subtitle || '', description: p.description || '', analysis: p.analysis || '' };
      });
    }
    if (config.contact?.fields) {
      window.dynamicContactFields = config.contact.fields;
      renderDynamicContactFields();
    }
    if (config.contact) updateContactDynamic(config.contact);
    if (config.social) {
      updateSocialLink('instagram', config.social.instagram, '.containerOne');
      updateSocialLink('tiktok', config.social.tiktok, '.containerFive');
      updateSocialLink('youtube', config.social.youtube, '.containerSix');
      updateSocialLink('telegram', config.social.telegram, '.containerSeven');
      updateSocialLink('whatsapp', config.social.whatsapp, '.containerFour');
      updateContactInfo(config.social);
    }
    if (config.media?.carousel?.length > 0) renderCarousel(config.media.carousel);
    if (config.media?.studioImage) {
      const studioImg = document.querySelector('#studio .studio-image img, [data-studio-img]');
      if (studioImg) studioImg.src = config.media.studioImage.trim();
    }
    if (config.media?.problemVideoUrl) {
      const problemVideo = document.getElementById('problem-video');
      if (problemVideo) {
        let videoUrl = config.media.problemVideoUrl.trim();
        if (!videoUrl.includes('?')) videoUrl += '?autoplay=0&controls=1&rel=0&modestbranding=1';
        problemVideo.src = videoUrl;
      }
    }
    if (config.reviews?.list?.length > 0) renderReviews(config.reviews.list);
    if (config.contact?.sidebarTitle) {
      const quoteEl = document.getElementById('contact-modal-quote');
      if (quoteEl) quoteEl.textContent = `"${config.contact.sidebarTitle}"`;
    }
    if (config.contact?.successMessage) {
      ['success-message', 'quiz-success-message'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = config.contact.successMessage;
      });
    }
    if (config.general?.maintenanceMode) showMaintenanceBanner();
  }

  function renderDynamicContactFields() {
    const container = document.getElementById('dynamic-contact-steps');
    const fields = getContactFields();
    if (!container) return;
    container.innerHTML = '';
    fields.forEach((field, index) => {
      const stepNum = index + 1;
      let fieldHTML = '';
      if (field.type === 'textarea') {
        fieldHTML = `<div class="contact-step active" data-step="${stepNum}"><label for="${field.id}" class="step-label">${field.label}</label><textarea id="${field.id}" name="${field.id}" data-label="${field.label}" placeholder="${field.placeholder || ''}" rows="4" required></textarea><span class="input-error" id="error-${field.id}">Campo obbligatorio</span></div>`;
      } else if (field.type === 'scale') {
        fieldHTML = `<div class="contact-step active" data-step="${stepNum}"><label class="step-label">${field.label}</label><div class="range-wrapper"><span class="range-label-min">${field.scaleMin || '1'}</span><input type="range" id="${field.id}" name="${field.id}" data-label="${field.label}" min="1" max="10" value="5" required><span class="range-label-max">${field.scaleMax || '10'}</span></div><div id="${field.id}-value">5/10</div><span class="input-error" id="error-${field.id}">Seleziona un valore</span></div>`;
      } else if (field.type === 'radio') {
        const groupName = `${field.id}_radio_group`;
        const options = field.options || ['Sì', 'No', 'Altro'];
        let radioHTML = options.map(opt => {
          const safeOpt = opt.toLowerCase().replace(/[^a-z0-9]/g, '_');
          return `<label class="radio-label"><input type="radio" id="${field.id}_${safeOpt}" name="${groupName}" value="${opt}" data-label="${field.label}" required> ${opt}</label>`;
        }).join('');
        if (options.includes('Altro')) radioHTML += `<input type="text" id="${field.id}_altro_input" name="${field.id}_altro" placeholder="Specifica..." class="altro-input" style="display:none; margin-top:10px; width:100%; padding:8px; border:1px solid #ccc; border-radius:4px;">`;
        fieldHTML = `<div class="contact-step active" data-step="${stepNum}"><fieldset class="step-fieldset"><legend class="step-label">${field.label}</legend><div class="radio-group">${radioHTML}</div></fieldset><span class="input-error" id="error-${field.id}">Seleziona un'opzione</span></div>`;
      }
      container.insertAdjacentHTML('beforeend', fieldHTML);
    });
    // Gli step dinamici si inseriscono DOPO i 5 campi base e PRIMA di
    // "servizio selezionato" + "privacy": ricalcolo gli indici degli step fissi finali.
    const nDyn = fields ? fields.length : 0;
    contactTotalSteps = 5 + nDyn + 2;
    const serviceStep = document.querySelector('[data-step="fixed-service"]');
    const privacyStep = document.querySelector('[data-step="fixed-privacy"]');
    if (serviceStep) serviceStep.setAttribute('data-step', 5 + nDyn + 1);
    if (privacyStep) privacyStep.setAttribute('data-step', contactTotalSteps);
    initDynamicFieldListeners();
  }

  function initDynamicFieldListeners() {
    document.querySelectorAll('input[type="range"]').forEach(range => {
      const valueDisplay = document.getElementById(`${range.id}-value`);
      if (valueDisplay) {
        valueDisplay.textContent = `${range.value}/10`;
        range.addEventListener('input', (e) => { valueDisplay.textContent = `${e.target.value}/10`; });
      }
    });
    document.querySelectorAll('input[type="radio"][value="Altro"]').forEach(radio => {
      const fieldId = radio.name.replace('_radio_group', '');
      const altroInput = document.getElementById(`${fieldId}_altro_input`);
      const radioGroup = document.querySelectorAll(`input[name="${radio.name}"]`);
      radioGroup.forEach(r => {
        r.addEventListener('change', (e) => {
          if (altroInput) {
            if (e.target.value === 'Altro') { altroInput.style.display = 'block'; altroInput.required = true; setTimeout(() => altroInput.focus(), 100); }
            else { altroInput.style.display = 'none'; altroInput.required = false; altroInput.value = ''; }
          }
        });
      });
    });
  }

  function injectFacebookPixel(pixelId) {
    const existing = document.querySelector('script[data-facebook-pixel]');
    if (existing) existing.remove();
    if (!pixelId?.trim()) return;
    const script = document.createElement('script');
    script.setAttribute('data-facebook-pixel', 'true');
    script.text = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init', '${pixelId}');fbq('track', 'PageView');`;
    document.head.appendChild(script);
  }

  function updateContactDynamic(contactData) {
    if (!contactData) return;
    if (contactData.sidebarTitle) { const el = document.getElementById('contact-modal-quote'); if (el) el.textContent = `"${contactData.sidebarTitle}"`; }
    if (contactData.successMessage) {
      ['success-message', 'quiz-success-message'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = contactData.successMessage; });
    }
  }

  function updateSocialLink(platform, url, selector) {
    const el = document.querySelector(selector);
    if (el && url?.trim() && el.tagName === 'A') el.href = url.trim();
  }

  function updateContactInfo(social) {
    const contactInfo = document.querySelector('.contact-info');
    if (!contactInfo || !social) return;
    const paragraphs = contactInfo.querySelectorAll('p');
    if (social.address && paragraphs[0]) paragraphs[0].innerHTML = `<span>📍 ${escapeHtml(social.address)}</span>`;
    if (social.phone && paragraphs[1]) paragraphs[1].innerHTML = `<span>📞 ${escapeHtml(social.phone)}</span>`;
    if (social.email && paragraphs[2]) paragraphs[2].innerHTML = `<span>✉️ ${escapeHtml(social.email)}</span>`;
  }

  function renderCarousel(images) {
    const slider = document.getElementById('image-slider');
    if (!slider) return;
    const slides = slider.querySelectorAll('.slide');
    images.forEach((url, i) => { if (slides[i]) { slides[i].src = url.trim(); slides[i].classList.toggle('active', i === 1); } });
  }

  function renderReviews(reviews) {
    // Normalizza i campi: le recensioni possono arrivare come {name, rating, date/time, text}
    // dal DB o dalla config dinamica. Garantiamo SEMPRE la presenza di `time` (la data
    // mostrata sotto il nome nella card), altrimenti il footer resterebbe vuoto.
    const normalized = (reviews || []).map(r => ({
      name: r.name || '',
      rating: Number(r.rating != null ? r.rating : (r.stars != null ? r.stars : 5)) || 5,
      text: r.text || r.description || '',
      time: r.time || r.date || fmtReviewDate(r.date) || ''
    }));
    // Usa lo stesso renderer delle card della Home (con "Leggi di più" e stelle FA),
    // così l'aspetto è identico sia al primo caricamento che negli aggiornamenti live.
    window.__dynamicReviewsPending = normalized;
    if (typeof window.__renderTestimonialCards === 'function') {
      window.__renderTestimonialCards(normalized);
    }
  }

  // Velocità del marquee: costante (~28 px/s), così lo scorrimento è "normale"
  // e non troppo veloce, indipendentemente dal numero di recensioni.
  const MARQUEE_PX_PER_SECOND = 28;
  function applyMarqueeDuration(track, count) {
    requestAnimationFrame(() => {
      const halfWidth = track.scrollWidth / 2; // metà = un giro completo (card duplicate)
      if (halfWidth > 0) {
        const duration = Math.max(45, Math.round(halfWidth / MARQUEE_PX_PER_SECOND));
        track.style.animationDuration = duration + 's';
      } else {
        track.style.animationDuration = Math.max(80, count * 16) + 's';
      }
    });
  }

  function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  function showMaintenanceBanner() {
    if (document.getElementById('maintenance-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'maintenance-banner';
    banner.innerHTML = `<div style="background:linear-gradient(135deg,#1c1c1c,#2d2d2d);color:#fff;text-align:center;padding:.75rem 1rem;font-size:.875rem;font-weight:600;position:fixed;top:67px;left:0;right:0;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;gap:.5rem"><i class="fa-solid fa-triangle-exclamation" style="color:#fbbf24"></i><span>Sito in manutenzione - Alcune funzionalità potrebbero non essere disponibili</span><a href="https://wa.me/393458407102" target="_blank" rel="noopener" style="background: #22c55e00;color: #22c55e;padding: 0.25rem 0.75rem;border-radius:6px;text-decoration:none;font-size:.75rem;font-weight:700;margin: 10px;white-space:nowrap;transition:background .3s"><i class="fa-brands fa-whatsapp"></i> Scrivimi</a></div>`;
    document.body.insertBefore(banner, document.body.firstChild);
    document.body.style.paddingTop = '50px';
  }

  // ============================================
  // 3. CORE UI INITIALIZATIONS
  // ============================================

  // Il preloader ormai è gestito da uno script INLINE in index.html
  // (auto-sufficiente, parte immediatamente durante il parsing del DOM).
  // Qui ci limitiamo a una RETE DI SALVATAGGIO: se per qualsiasi motivo
  // l'inline non fosse riuscito ad avviare/nascondere il loader, lo
  // nascondiamo comunque noi — così la home non resta MAI bloccata.
  function ensureLoaderHidden() {
    const siteLoader = document.getElementById('site-loader');
    if (!siteLoader || siteLoader.style.display === 'none') return;
    if (siteLoader.dataset.loaderStarted !== 'true') {
      // Loader mai avviato: niente animazione, nascondilo direttamente.
      siteLoader.style.display = 'none';
      document.body.classList.remove('loading');
      document.body.classList.add('loaded');
    }
  }

  function initHeader() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function initMobileMenu() {
    const burger = document.querySelector('.burger');
    const menu = document.querySelector('.mobile-menu');
    if (!burger || !menu) return;
    const closeBtn = menu.querySelector('.menu-close');
    
    function closeMenu() {
      menu.classList.remove('open'); burger.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Apri menu');
      document.body.classList.remove('menu-open'); document.body.style.overflow = '';
    }
    
    // ✅ CORREZIONE: Espone la funzione globalmente per evitare ReferenceError
    window.closeMobileMenu = closeMenu;

    function openMenu() {
      menu.classList.add('open'); burger.classList.add('open');
      burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Chiudi menu');
      document.body.classList.add('menu-open'); document.body.style.overflow = 'hidden';
    }
    
    burger.addEventListener('click', () => { menu.classList.contains('open') ? closeMenu() : openMenu(); });
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('open')) closeMenu(); });
    menu.querySelectorAll('a, button:not(.menu-close):not([data-open-agreement])').forEach((el) => el.addEventListener('click', closeMenu));
  }

  function initReveal() {
    const items = document.querySelectorAll('.reveal');
    if (!items.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    items.forEach((el) => io.observe(el));

    // Sicurezza: se un elemento .reveal non viene marcato "visible" entro qualche secondo
    // (observer non innescato, animazioni bloccate altrove), lo mostriamo comunque,
    // così niente resta invisibile o "a scatti".
    setTimeout(() => {
      document.querySelectorAll('.reveal:not(.visible)').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('visible');
      });
    }, 2500);
  }

  function initFaq() {
    document.querySelectorAll('.faq-q').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        const answer = item.querySelector('.faq-a');
        const isOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item.open').forEach((other) => { other.classList.remove('open'); other.querySelector('.faq-a').style.maxHeight = null; });
        if (!isOpen) { item.classList.add('open'); answer.style.maxHeight = answer.scrollHeight + 'px'; }
      });
    });
  }

  function initRadioCards() {
    document.querySelectorAll('.radio-row').forEach((row) => {
      row.querySelectorAll('label').forEach((label) => {
        label.addEventListener('click', () => {
          row.querySelectorAll('label').forEach((l) => l.classList.remove('selected'));
          label.classList.add('selected');
          const input = label.querySelector('input');
          if (input) input.checked = true;
        });
      });
    });
  }

  function initCookies() {
    const banner = document.querySelector('.cookie-banner');
    if (!banner) return;
    if (!localStorage.getItem('vm-cookie-consent')) setTimeout(() => banner.classList.add('show'), 1800);
    banner.querySelector('[data-consent="yes"]')?.addEventListener('click', () => { localStorage.setItem('vm-cookie-consent', 'accepted'); banner.classList.remove('show'); });
    banner.querySelector('[data-consent="no"]')?.addEventListener('click', () => { localStorage.setItem('vm-cookie-consent', 'essential'); banner.classList.remove('show'); });
  }

  function initYear() {
    const y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();
  }

  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href === '#') return;
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function initCountdown() {
    const countdownEl = document.getElementById('countdown');
    if (!countdownEl) return;
    let time = 6 * 60 + 59;
    function update() {
      const minutes = Math.floor(time / 60);
      const seconds = time % 60;
      countdownEl.textContent = `${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
      if (time > 0) time--; else time = 6 * 60 + 59;
    }
    update();
    setInterval(update, 1000);
  }

  function initImageSlider() {
    const sliderContainer = document.getElementById('image-slider');
    const slides = sliderContainer ? sliderContainer.querySelectorAll('.slide') : [];
    if (slides.length <= 1) return;
    let currentSlide = 1;
    function nextSlide() {
      slides.forEach((slide, index) => slide.classList.toggle('active', index === currentSlide));
      currentSlide = (currentSlide + 1) % slides.length;
    }
    setInterval(nextSlide, 4000);
  }

  function initTestimonials() {
    const track = document.getElementById('testimonials-track');
    if (!track) return;
    // Le recensioni NON sono più hardcodate qui: provengono esclusivamente dal
    // database Firestore (collection 'reviews') gestito dalla dashboard admin.
    // Se il DB è vuoto, la sezione resta senza card finché l'admin non pubblica.
    window.__testimonials = [];
    function createCard(data, index) {
      // "index" qui è l'indice nella lista originale (le card duplicate del
      // marquee ricevono un data-idx che punta comunque alla stessa recensione).
      const isLong = data.text.length > 150;
      const stars = '<i class="fa-solid fa-star"></i>'.repeat(Math.max(0, Math.min(5, Number(data.rating) || 5)));
      return `<div class="testimonial-item"><div class="testimonial-card-inner"><div class="testimonial-stars">${stars}</div><div class="testimonial-text-wrapper"><p class="testimonial-text" id="testimonial-text-${index}" data-full="${escapeHtml(data.text)}">"${escapeHtml(data.text)}"</p>${isLong ? `<button class="testimonial-read-more" onclick="window.toggleReviewText(${index})" id="review-btn-${index}">Leggi di più <i class="fa-solid fa-chevron-down"></i></button>` : ''}</div><div class="testimonial-footer"><div class="testimonial-author"><h4 class="testimonial-name">${escapeHtml(data.name)}</h4><p class="testimonial-time">${escapeHtml(data.time || '')}</p></div><div class="testimonial-icon"><i class="fa-brands fa-google"></i></div></div></div></div>`;
    }
    window.__renderTestimonialCards = (list) => {
      if (!track) return;
      // Marquee infinito: duplica le card per lo scorrimento continuo da destra a sinistra.
      // Le copie usano gli stessi id (onclick -> toggleReviewText(index)) così il testo
      // completo si aggiorna in tutte le istanze della stessa recensione.
      const all = [...list, ...list];
      track.innerHTML = all.map((data, i) => createCard(data, i % list.length)).join('');
      applyMarqueeDuration(track, list.length);
    };
    if (window.__dynamicReviewsPending && window.__dynamicReviewsPending.length) {
      window.__renderTestimonialCards(window.__dynamicReviewsPending);
    }
  }

  function initMobileHoverEffects() {
    const addEffect = (selector) => {
      document.querySelectorAll(selector).forEach(element => {
        element.addEventListener('touchstart', function() { this.classList.add('active'); }, { passive: true });
        element.addEventListener('touchend', function() { setTimeout(() => this.classList.remove('active'), 300); }, { passive: true });
        element.addEventListener('touchcancel', function() { this.classList.remove('active'); }, { passive: true });
      });
    };
    addEffect('.problem-item, .benefit-card, .quiz-card, .service-card, .faq-item, .video-quote, .about-quote, .testimonial-card-inner');
    addEffect('.btn-cta, .btn-cta-main, #Contattami, #iniziatquiz, #inziailtuoopercorso2, #inziailtuoopercorso3, #inziailtuoopercorso4, #RichiediInformazioni, #RichiediInformazioni2, #RichiediInformazioni3, #bntprenota, .btn-whatsapp, .btn-step-next, .btn-submit, #contact-submit-btn, #quiz-submit-btn');
    addEffect('.nav-link, .mobile-links a, .btn-mobile, .socialContainer');
  }

  function initViewportFix() {
    const metaViewport = document.querySelector('meta[name="viewport"]');
    if (metaViewport) metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
  }

  /* ==========================================================================
     NAVBAR – STATO ATTIVO IN BASE ALLA PAGINA CORRENTE
     ========================================================================== */
  function initActiveNav() {
    const normalize = (p) => (p || '').split('#')[0].split('?')[0].replace(/\/+$/, '').split('/').pop() || 'index.html';
    const current = normalize(location.pathname);
    const links = document.querySelectorAll('.nav-links a, .nav-links .nav-link-btn, .mobile-menu a, .mobile-menu .nav-link-btn');
    if (!links.length) return;

    const setActive = (el) => {
      links.forEach(l => { l.classList.remove('active'); l.removeAttribute('aria-current'); });
      if (!el) return;
      el.classList.add('active');
      el.setAttribute('aria-current', 'page');
    };

    /* 1) Multi-pagina */
    let match = null;
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript')) return;
      if (normalize(href) === current && !match) match = link;
    });
    if (match) { setActive(match); return; }

    /* 2) Fallback scroll-spy (ancore #servizi, #metodo…) */
    const map = new Map();
    links.forEach(l => {
      const href = l.getAttribute('href') || '';
      if (!href.startsWith('#')) return;
      const sec = document.getElementById(href.slice(1));
      if (sec) map.set(sec, l);
    });
    if (!map.size) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) setActive(map.get(e.target)); });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    map.forEach((_, sec) => observer.observe(sec));
  }

  // ============================================
  // 4. MODALS (Agreement, Service, Cert, Contact, Quiz)
  // ============================================
  function initAgreementModal() {
    const modal = document.getElementById('agreement-modal');
    if (!modal) return;
    const openers = document.querySelectorAll('[data-open-agreement]');
    const closers = modal.querySelectorAll('[data-close-agreement], .modal-close');
    let lastFocused = null;
    
    function open() {
      lastFocused = document.activeElement;
      modal.hidden = false;
      requestAnimationFrame(() => modal.classList.add('is-open'));
      document.body.style.overflow = 'hidden';
      const focusable = modal.querySelector('.modal-close');
      if (focusable) focusable.focus();
    }
    
    function close() {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
      setTimeout(() => { modal.hidden = true; }, 280);
      if (lastFocused) lastFocused.focus();
    }
    
    // ✅ CORREZIONE: previene il salto della pagina e chiama la funzione in modo sicuro
    openers.forEach(b => b.addEventListener('click', (e) => { 
      e.preventDefault(); 
      if (typeof window.closeMobileMenu === 'function') window.closeMobileMenu(); 
      open(); 
    }));
    
    closers.forEach(b => b.addEventListener('click', close));
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !modal.hidden) close();
      if (e.key === 'Tab' && !modal.hidden) {
        const items = [...modal.querySelectorAll('button, a[href]')].filter(el => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  function initServiceModal() {
    const modal = document.getElementById('service-modal');
    if (!modal) return;
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const confirmBtn = document.getElementById('modal-confirm-btn');
    let currentServiceKey = '';
    // "bookForm" = il servizio apre direttamente il modulo di prenotazione (popup),
    // senza passare dal popup di avviso intermedio «Procedi / Annulla».
    let serviceData = {
      'piano-autonomo': { type: 'Piano Digitale', title: 'Piano autonomo P.E.R.S.M.A.R.T.', desc: 'Stai per acquistare il questionario approfondito e il piano personale scritto da Valeria. Verrai reindirizzato alla pagina di checkout sicuro.', actionUrl: 'acquista-piano.html' },
      'sessione-studio': { type: 'Sessione Individuale', title: 'Sessione in studio', desc: '', actionUrl: 'prenota.html?tipo=studio', bookForm: true },
      'sessione-online': { type: 'Sessione Individuale', title: 'Sessione online', desc: '', actionUrl: 'prenota.html?tipo=online', bookForm: true },
      'percorso-gruppo': { type: 'Percorso di Gruppo', title: 'Percorsi di gruppo', desc: 'Lascia i tuoi dati per essere avvisato non appena si apriranno le iscrizioni al prossimo percorso di gruppo a numero chiuso.', actionUrl: 'servizi.html#gruppi' }
    };
    // Se la dashboard admin ha popolato 'service_packages', usa i pacchetti del database
    if (window.__dynamicPackages && Object.keys(window.__dynamicPackages).length > 0) {
      serviceData = {};
      Object.entries(window.__dynamicPackages).forEach(([k, p]) => {
        // mantieni il comportamento «modulo diretto» per le sessioni prenotabili;
        // anche un pacchetto nuovo con link "prenota.html" apre direttamente il modulo
        const isBookable = k === 'sessione-studio' || k === 'sessione-online'
          || /prenota\.html/.test(p.actionUrl || '') || p.bookForm === true;
        serviceData[k] = { type: p.type || 'Servizio', title: p.name || k, desc: p.desc || '', actionUrl: p.actionUrl || '', bookForm: isBookable };
      });
    }
    function openModal(serviceKey) {
      const data = serviceData[serviceKey];
      if (!data) return;
      // "Prenota in studio" / "Prenota online": niente popup di avviso intermedio,
      // apri direttamente il modulo di prenotazione (servizio già selezionato).
      if (data.bookForm || /prenota\.html/.test(data.actionUrl || '')) {
        openContactModal(contactFormTemplateId, data.title);
        return;
      }
      document.getElementById('modal-service-type').textContent = data.type;
      document.getElementById('modal-service-title').textContent = data.title;
      document.getElementById('modal-service-desc').textContent = data.desc;
      confirmBtn.setAttribute('data-target-url', data.actionUrl);
      currentServiceKey = serviceKey;
      // Modulo di richiesta personalizzato (domande create dalla dashboard):
      // se attivo, il popup mostra Nome/Cognome/Email + domande invece del semplice «Procedi»
      buildServiceRequestForm(serviceKey);
      modal.hidden = false;
      requestAnimationFrame(() => { modal.classList.add('is-open'); });
      document.body.style.overflow = 'hidden';
    }
    function closeModal() {
      modal.classList.remove('is-open');
      setTimeout(() => { modal.hidden = true; document.body.style.overflow = ''; }, 300);
    }
    document.querySelectorAll('[data-service-modal]').forEach(btn => {
      btn.addEventListener('click', (e) => { e.preventDefault(); openModal(btn.getAttribute('data-service-modal')); });
    });
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    confirmBtn.addEventListener('click', () => {
      const reqForm = document.getElementById('svc-request-fields');
      if (reqForm && !reqForm.hidden) { submitServiceRequest(); return; }
      const data = serviceData[currentServiceKey];
      const url = confirmBtn.getAttribute('data-target-url') || '';
      // Per i pacchetti prenotabili (o senza link proprio) apri il popup con il
      // modulo di richiesta: servizio selezionato + nome, cognome, email, telefono, messaggio.
      if (/prenota\.html/.test(url) || !url) {
        closeModal();
        setTimeout(() => openContactModal(contactFormTemplateId, data ? data.title : ''), 320);
        return;
      }
      if (url) window.location.href = url;
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });
  }

  // ---- MODULO DI RICHIESTA DEL PACCHETTO (popup Home, gestito dalla dashboard) ----
  function getActiveFormQuestions() {
    return (window.__dynamicFormQuestions || []).filter(q => q.active !== false)
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  }

  function buildServiceRequestForm(serviceKey) {
    const container = document.getElementById('svc-request-fields');
    if (!container) return;
    let questions = getActiveFormQuestions();
    // se il pacchetto ha domande collegate solo per sé (questionKeys), usa quelle
    const dynPkg = (window.__dynamicPackages || {})[serviceKey];
    if (dynPkg && Array.isArray(dynPkg.questionKeys) && dynPkg.questionKeys.length > 0) {
      questions = questions.filter(q => dynPkg.questionKeys.includes(q.id));
    }
    const labels = (window.__dynamicServiceLabels && window.__dynamicServiceLabels.formLabels) || {};
    const lblNome = labels.nome || 'Nome', lblCognome = labels.cognome || 'Cognome', lblEmail = labels.email || 'Email';
    const confirmBtn = document.getElementById('modal-confirm-btn');
    if (!questions.length) {
      container.hidden = true;
      container.innerHTML = '';
      if (confirmBtn) confirmBtn.innerHTML = 'Procedi <i class="fa-solid fa-arrow-right" style="margin-left: 8px;"></i>';
      return;
    }
    let html = '<div class="svc-std-fields">'
      + '<label for="svc-nome">' + escapeHtml(lblNome) + ' *</label><input type="text" id="svc-nome" required />'
      + '<label for="svc-cognome">' + escapeHtml(lblCognome) + ' *</label><input type="text" id="svc-cognome" required />'
      + '<label for="svc-email">' + escapeHtml(lblEmail) + ' *</label><input type="email" id="svc-email" required /></div>';
    questions.forEach((q, idx) => {
      const reqMark = q.required ? ' *' : '';
      html += `<div class="svc-q-field" data-qid="${q.id}" data-ftype="${q.fieldType}"><label>${escapeHtml(q.text)}${reqMark}</label>`;
      if (q.fieldType === 'long') html += `<textarea rows="3" data-qinput></textarea>`;
      else if (q.fieldType === 'multiple') html += `<select data-qinput><option value="">Seleziona…</option>` + (q.options || []).map(o => `<option>${escapeHtml(o)}</option>`).join('') + `</select>`;
      else if (q.fieldType === 'checkbox') html += (q.options || []).map(o => `<label class="svc-check-label"><input type="checkbox" value="${escapeHtml(o)}" /> ${escapeHtml(o)}</label>`).join('');
      else html += `<input type="text" data-qinput />`;
      html += '</div>';
    });
    container.innerHTML = html;
    container.hidden = false;
    if (confirmBtn) confirmBtn.innerHTML = 'Invia richiesta <i class="fa-solid fa-paper-plane" style="margin-left: 8px;"></i>';
  }

  async function submitServiceRequest() {
    const nome = (document.getElementById('svc-nome')?.value || '').trim();
    const cognome = (document.getElementById('svc-cognome')?.value || '').trim();
    const email = (document.getElementById('svc-email')?.value || '').trim();
    if (!nome || !cognome || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { alert('Inserisci nome, cognome e un\'email valida.'); return; }
    const answers = {};
    const requiredMissing = [];
    document.querySelectorAll('#svc-request-fields .svc-q-field').forEach(div => {
      const ftype = div.dataset.ftype;
      const label = div.querySelector('label')?.textContent || div.dataset.qid;
      let value = '';
      if (ftype === 'checkbox') {
        value = Array.from(div.querySelectorAll('input[type=checkbox]:checked')).map(c => c.value);
      } else {
        const inp = div.querySelector('[data-qinput]');
        value = inp ? inp.value.trim() : '';
      }
      const isReq = label.trim().endsWith('*');
      const empty = Array.isArray(value) ? value.length === 0 : !value;
      if (isReq && empty) requiredMissing.push(label.replace(' *', ''));
      answers[label.replace(' *', '')] = value;
    });
    if (requiredMissing.length) { alert('Completa le domande obbligatorie: ' + requiredMissing.join(', ')); return; }
    const btn = document.getElementById('modal-confirm-btn');
    const pkg = (window.__dynamicPackages || {})[currentServiceKey] || {};
    if (btn) btn.disabled = true;
    try {
      if (window.firebaseDB && window.firebaseCollection && window.firebaseAddDoc) {
        await window.firebaseAddDoc(window.firebaseCollection(window.firebaseDB, 'service_requests'), {
          packageKey: currentServiceKey,
          servizio: pkg.name || currentServiceKey,
          nome, cognome, email, answers,
          createdAt: new Date().toISOString()
        });
      } else { throw new Error('database non disponibile'); }
      const okMsg = document.createElement('p');
      okMsg.style.cssText = 'color:#2e7d4f;font-weight:600;margin-top:12px;';
      okMsg.textContent = '✔ Richiesta inviata. Ti risponderò al più presto.';
      document.getElementById('svc-request-fields').replaceChildren(okMsg);
      setTimeout(() => { const m = document.getElementById('service-modal'); if (m) m.querySelector('.modal-close')?.click(); }, 2500);
    } catch (err) {
      console.error('Errore invio richiesta:', err);
      alert('Invio non riuscito: riprova oppure contattami via email.');
    } finally { if (btn) btn.disabled = false; }
  }
  function initCertModal() {
    const modal = document.getElementById('cert-modal');
    if (!modal) return;
    function open() {
      modal.hidden = false;
      requestAnimationFrame(() => modal.classList.add('is-open'));
      document.body.style.overflow = 'hidden';
      const btn = modal.querySelector('.modal-close');
      if (btn) btn.focus();
    }
    function close() {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
      setTimeout(() => { modal.hidden = true; }, 280);
      const trigger = document.querySelector('[data-open-cert-modal]');
      if (trigger) trigger.focus();
    }
    document.querySelectorAll('[data-open-cert-modal]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        const agr = document.getElementById('agreement-modal');
        if (agr && !agr.hidden) { agr.classList.remove('is-open'); setTimeout(open, 260); }
        else { open(); }
      });
    });
    modal.querySelectorAll('[data-close-cert], .modal-close').forEach(b => b.addEventListener('click', close));
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) close(); });
  }

  function showCopyToast(message) {
    let toast = document.getElementById('copy-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'copy-toast';
      toast.className = 'copy-toast';
      toast.setAttribute('role', 'status');
      document.body.appendChild(toast);
    }
    toast.innerHTML = '<i class="fa-solid fa-circle-check"></i> ' + message;
    requestAnimationFrame(() => toast.classList.add('show'));
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function initCopyIban() {
    document.querySelectorAll('.btn-copy-iban').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.copyBusy === '1') return;
        const iban = btn.getAttribute('data-copy-iban') || '';
        const done = ok => {
          btn.dataset.copyBusy = '1';
          btn.classList.toggle('is-copied', !!ok);
          btn.classList.toggle('copy-failed', !ok);
          if (ok) showCopyToast('IBAN copiato negli appunti ✓');
          else showCopyToast('Copia non riuscita: seleziona l\'IBAN e copialo manualmente');
          setTimeout(() => {
            btn.classList.remove('is-copied', 'copy-failed');
            btn.dataset.copyBusy = '';
          }, 2000);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(iban).then(() => done(true)).catch(() => fallback());
        } else { fallback(); }
        function fallback() {
          const ta = document.createElement('textarea');
          ta.value = iban; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
          document.body.removeChild(ta); done(ok);
        }
      });
    });
  }

  // --- CONTACT MODAL LOGIC ---
  function buildContactFormSummary() {
    const lines = ['', ''];
    const fields = getContactFields();
    if (fields && fields.length > 0) {
      fields.forEach((field) => {
        let inputEl = document.getElementById(field.id);
        if (!inputEl && field.id) inputEl = document.querySelector(`[name="${field.id}"]`);
        if (!inputEl && field.label) {
          const labelSnippet = field.label.substring(0, 20);
          inputEl = document.querySelector(`textarea[data-label*="${labelSnippet}"], input[data-label*="${labelSnippet}"]`);
        }
        if (!inputEl) {
          lines.push(`❓ ${field.label?.replace('*', '').trim() || 'Campo sconosciuto'}`);
          lines.push(`   ↳ ⚠️ Campo non trovato nel form`);
          lines.push('');
          return;
        }
        let answer = '';
        if (inputEl.type === 'radio') {
          const groupName = `${field.id}_radio_group`;
          const checked = document.querySelector(`input[name="${groupName}"]:checked`);
          if (checked) {
            answer = checked.value;
            if (answer === 'Altro') {
              const altroVal = document.getElementById(`${field.id}_altro_input`)?.value?.trim();
              answer = altroVal ? `Altro: ${altroVal}` : 'Altro';
            }
          }
        } else if (inputEl.type === 'checkbox') {
          answer = inputEl.checked ? '✅ Accettato' : '❌ Non accettato';
        } else if (inputEl.type === 'range') {
          answer = `${inputEl.value}/10`;
        } else {
          answer = inputEl.value || '';
        }
        const cleanLabel = field.label?.replace('*', '').trim() || 'Domanda';
        const cleanAnswer = answer?.trim() || '⚠️ Non risposto';
        lines.push(`❓ ${cleanLabel}`);
        lines.push(`   ↳ ${cleanAnswer.replace(/\n/g, ' ')}`);
        lines.push('');
      });
    }
    lines.push(`📅 Inviato il: ${new Date().toLocaleString('it-IT')}`);
    return lines.join('\n');
  }

  function validateContactStep(step) {
    const currentStepEl = document.querySelector(`.contact-step[data-step="${step}"]`);
    if (!currentStepEl) return true;
    let isValid = true;
    const requiredFields = currentStepEl.querySelectorAll('[required]');
    requiredFields.forEach(field => {
      if (field.style.display === 'none') return;
      const errorId = `error-${field.name || field.id}`;
      const errorEl = document.getElementById(errorId);
      let fieldValue = field.value?.trim();
      if (field.type === 'radio') {
        const groupName = field.name;
        const checked = document.querySelector(`input[name="${groupName}"]:checked`);
        if (!checked) { if (errorEl) { errorEl.style.display = 'block'; errorEl.textContent = "Seleziona un'opzione *"; } isValid = false; }
        else if (checked.value === 'Altro') {
          const fieldId = groupName.replace('_radio_group', '');
          const altroInput = document.getElementById(`${fieldId}_altro_input`);
          if (altroInput && !altroInput.value.trim()) { if (errorEl) { errorEl.style.display = 'block'; errorEl.textContent = "Specifica l'opzione *"; } isValid = false; }
        }
      } else if (field.type === 'checkbox') {
        if (!field.checked) { if (errorEl) { errorEl.style.display = 'block'; errorEl.textContent = 'Devi accettare per continuare *'; } isValid = false; }
      } else if (field.type === 'range') {
        if (!fieldValue || fieldValue === '') { if (errorEl) { errorEl.style.display = 'block'; errorEl.textContent = 'Seleziona un valore *'; } isValid = false; }
      } else if (!fieldValue) {
        if (errorEl) { errorEl.style.display = 'block'; errorEl.textContent = 'Campo obbligatorio *'; } isValid = false;
      } else if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fieldValue)) {
        if (errorEl) { errorEl.style.display = 'block'; errorEl.textContent = 'Email non valida *'; } isValid = false;
      }
      if (isValid && errorEl) errorEl.style.display = 'none';
    });
    return isValid;
  }

  function goToContactStep(step) {
    document.querySelectorAll('.contact-step').forEach(el => el.classList.remove('active'));
    const currentStepEl = document.querySelector(`.contact-step[data-step="${step}"]`);
    if (currentStepEl) currentStepEl.classList.add('active');
    const percent = Math.round((step / contactTotalSteps) * 100);
    const progressBar = document.getElementById('contact-progress-bar');
    const percentText = document.getElementById('contact-progress-percent');
    const stepLabel = document.getElementById('contact-step-label');
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (percentText) percentText.textContent = `${percent}%`;
    if (stepLabel) stepLabel.textContent = `Step ${step} di ${contactTotalSteps}`;
    const prevBtn = document.getElementById('contact-step-prev');
    const nextBtn = document.getElementById('contact-step-next');
    const submitBtn = document.getElementById('contact-submit-btn');
    if (prevBtn) prevBtn.style.display = step === 1 ? 'none' : 'block';
    if (nextBtn) nextBtn.style.display = step === contactTotalSteps ? 'none' : 'block';
    if (submitBtn) submitBtn.style.display = step === contactTotalSteps ? 'block' : 'none';
    contactCurrentStep = step;
    if (window.innerWidth < 768) document.getElementById('contact-modal-body')?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleContactSubmit(e) {
    e.preventDefault();
    if (!validateContactStep(contactCurrentStep)) {
      const firstError = document.querySelector('.contact-step.active .input-error[style*="display: block"]');
      if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const submitBtn = document.getElementById('contact-submit-btn');
    const originalBtnContent = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Invio in corso...';
    submitBtn.disabled = true;
    const templateParams = {
      name: ((document.getElementById('contact-name')?.value?.trim() || '') + ' ' + (document.getElementById('contact-cognome')?.value?.trim() || '')).trim() || 'Non specificato',
      email: document.getElementById('contact-email')?.value?.trim() || 'Non specificato',
      phone: document.getElementById('contact-phone')?.value?.trim() || 'Non specificato',
      message: document.getElementById('contact-message')?.value?.trim() || '',
      service: selectedServiceName || document.getElementById('contact-service')?.value || 'Richiesta generica',
      result: buildContactFormSummary(),
      privacy: document.getElementById('contact-privacy')?.checked ? 'Accettato' : 'Non accettato',
      sent_from: window.location.href,
      date: new Date().toLocaleString('it-IT')
    };
    emailjs.send('service_wnyvmph', contactFormTemplateId, templateParams)
      .then(function(response) {
        console.log('✅ Email inviata!', response);
        document.getElementById('contact-form-content')?.classList.add('hidden');
        document.getElementById('contact-success')?.classList.add('visible');
        submitBtn.innerHTML = originalBtnContent;
        submitBtn.disabled = false;
        document.getElementById('contact-form')?.reset();
        goToContactStep(1);
        if (typeof fbq === 'function') fbq('track', 'Contact');
      })
      .catch(function(error) {
        console.error('❌ EmailJS Error:', error);
        submitBtn.innerHTML = originalBtnContent;
        submitBtn.disabled = false;
        alert('⚠️ Errore durante l\'invio. Riprova o scrivimi su WhatsApp: +39 345 840 7102');
      });
  }

  function initContactStepForm() {
    initDynamicFieldListeners();
    const nextBtn = document.getElementById('contact-step-next');
    const prevBtn = document.getElementById('contact-step-prev');
    if (nextBtn) nextBtn.addEventListener('click', () => { if (validateContactStep(contactCurrentStep)) goToContactStep(Math.min(contactCurrentStep + 1, contactTotalSteps)); });
    if (prevBtn) prevBtn.addEventListener('click', () => { goToContactStep(Math.max(contactCurrentStep - 1, 1)); });
    const contactForm = document.getElementById('contact-form');
    if (contactForm) contactForm.addEventListener('submit', handleContactSubmit);
    window.resetContactForm = function() {
      const form = document.getElementById('contact-form');
      const formContent = document.getElementById('contact-form-content');
      const successState = document.getElementById('contact-success');
      if (form) form.reset();
      setSelectedService('');
      if (formContent) formContent.classList.remove('hidden');
      if (successState) successState.classList.remove('visible');
      goToContactStep(1);
      document.querySelectorAll('.input-error').forEach(el => el.style.display = 'none');
      document.querySelectorAll('input[type="range"]').forEach(range => {
        const valueDisplay = document.getElementById(`${range.id}-value`);
        if (valueDisplay) valueDisplay.textContent = `${range.value}/10`;
      });
    };
    goToContactStep(1);
  }

  // Mostra/nasconde lo step "Servizio selezionato" nel modulo contatto
  function setSelectedService(name) {
    selectedServiceName = name || '';
    const step = document.querySelector('#contact-form [data-step="fixed-service"]')
      || document.querySelector('#contact-form .selected-service-chip')?.closest('.contact-step');
    const labelEl = document.getElementById('selected-service-name');
    const hiddenEl = document.getElementById('contact-service');
    if (labelEl) labelEl.textContent = selectedServiceName || 'Richiesta generica';
    if (hiddenEl) hiddenEl.value = selectedServiceName;
    if (step) step.style.display = selectedServiceName ? '' : 'none';
  }

  function openContactModal(templateId, serviceName) {
    const modal = document.getElementById('contact-modal');
    if (!modal) return;
    setSelectedService(serviceName || '');
    if (activeModal) {
      const currentModal = document.getElementById(activeModal);
      if (currentModal) { currentModal.classList.remove('active'); document.body.classList.remove('modal-open'); document.body.style.top = ''; }
    }
    contactFormTemplateId = templateId || 'template_86ls76q';
    const scrollY = window.scrollY;
    document.documentElement.style.setProperty('--scroll-y', `${scrollY}px`);
    document.body.classList.add('modal-open');
    document.body.style.top = `-${scrollY}px`;
    modal.classList.remove('hidden');
    modal.removeAttribute('hidden'); // l'attributo hidden bloccherebbe il popup (CSS usa .hidden)
    modal.classList.add('active');
    activeModal = 'contact-modal';
    document.addEventListener('keydown', handleContactEscapeKey);
    window.resetContactForm();
    setTimeout(() => { const firstInput = modal.querySelector('.contact-step.active input:not([type=hidden]), .contact-step.active textarea'); if (firstInput) firstInput.focus(); }, 100);
  }

  function closeContactModal() {
    const modal = document.getElementById('contact-modal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('hidden', ''); // nasconde davvero il popup (attributo hidden)
    document.removeEventListener('keydown', handleContactEscapeKey);
    setTimeout(() => {
      const scrollY = document.documentElement.style.getPropertyValue('--scroll-y');
      document.body.classList.remove('modal-open');
      document.body.style.top = '';
      if (scrollY) window.scrollTo(0, parseInt(scrollY) || 0);
      document.documentElement.style.removeProperty('--scroll-y');
      if (activeModal === 'contact-modal') activeModal = null;
    }, 400);
  }

  function handleContactEscapeKey(e) { if (e.key === 'Escape') { e.preventDefault(); closeContactModal(); } }

  function initContactModal() {
    initContactStepForm();
    const contactModalTriggers = ['Contattami','inziailtuoopercorso2','RichiediInformazioni2','RichiediInformazioni3','RichiediInformazioni','inziailtuoopercorso3','bntprenota','prenotabottoneconsulenza','inziailtuoopercorso4'];
    contactModalTriggers.forEach(buttonId => {
      const btn = document.getElementById(buttonId);
      if (btn) btn.addEventListener('click', function(e) { e.preventDefault(); openContactModal('template_86ls76q'); });
    });
    const mobileContattami = document.getElementById('mobile-Contattami');
    if (mobileContattami) mobileContattami.addEventListener('click', function(e) { e.preventDefault(); setTimeout(() => openContactModal('template_86ls76q'), 300); });
    const contactModalCloseBtn = document.getElementById('contact-modal-close');
    if (contactModalCloseBtn) contactModalCloseBtn.addEventListener('click', closeContactModal);
    const successCloseBtn = document.getElementById('success-close-btn');
    if (successCloseBtn) successCloseBtn.addEventListener('click', closeContactModal);
    const contactModal = document.getElementById('contact-modal');
    if (contactModal) contactModal.addEventListener('click', function(e) { if (e.target === contactModal) closeContactModal(); });
  }

  // --- POPUP "SCEGLI LA MODALITÀ" (Parliamone insieme) ---
  function openModeModal() {
    const m = document.getElementById('contact-mode-modal');
    if (!m) return;
    m.hidden = false;
    requestAnimationFrame(() => m.classList.add('open'));
    document.body.style.overflow = 'hidden';
  }
  function closeModeModal() {
    const m = document.getElementById('contact-mode-modal');
    if (!m) return;
    m.classList.remove('open');
    setTimeout(() => { m.hidden = true; }, 280);
    document.body.style.overflow = '';
  }
  function initModeModal() {
    const openBtn = document.getElementById('contact-mode-open');
    if (openBtn) openBtn.addEventListener('click', function(e) { e.preventDefault(); openModeModal(); });
    document.querySelectorAll('[data-close-mode]').forEach(btn => btn.addEventListener('click', closeModeModal));
    const m = document.getElementById('contact-mode-modal');
    if (m) m.addEventListener('click', function(e) { if (e.target === m) closeModeModal(); });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && m && !m.hidden) closeModeModal();
    });
  }

  // --- QUIZ MODAL LOGIC ---
  function renderQuizQuestion() {
    const questions = getQuizQuestions();
    const question = questions[quizCurrentStep];
    if (!question) { showQuizResults(); return; }
    const progress = ((quizCurrentStep + 1) / questions.length) * 100;
    const progressBar = document.getElementById('quiz-progress-bar');
    const stepCounter = document.getElementById('quiz-step-counter');
    if (progressBar) progressBar.style.width = progress + '%';
    if (stepCounter) stepCounter.textContent = 'Domanda ' + (quizCurrentStep + 1) + ' di ' + questions.length;
    updateQuizProgressPercent();
    const questionText = document.getElementById('quiz-question-text');
    const optionsContainer = document.getElementById('quiz-options-container');
    if (questionText) questionText.textContent = question.text;
    if (optionsContainer) {
      optionsContainer.innerHTML = '';
      question.options.forEach(function(opt, index) {
        const btn = document.createElement('button');
        btn.className = 'quiz-option-btn';
        btn.innerHTML = '<span class="quiz-option-text">' + opt.text + '</span><i class="fa-solid fa-chevron-right quiz-option-icon"></i>';
        btn.addEventListener('click', function() { handleQuizAnswer(opt.score); });
        optionsContainer.appendChild(btn);
      });
    }
  }

  function handleQuizAnswer(score) {
    quizScores[score]++;
    quizCurrentStep++;
    const container = document.getElementById('quiz-question-container');
    container.style.opacity = '0';
    setTimeout(() => { renderQuizQuestion(); container.style.opacity = '1'; }, 250);
  }

  function showQuizResults() {
    const questionContainer = document.getElementById('quiz-question-container');
    const resultContainer = document.getElementById('quiz-result-container');
    const contactSection = document.getElementById('quiz-contact-section');
    questionContainer.classList.add('hidden');
    const pPct = document.getElementById('quiz-progress-percent'); if (pPct) pPct.textContent = '100%';
    const pBar = document.getElementById('quiz-progress-bar'); if (pBar) pBar.style.width = '100%';
    resultContainer.classList.add('visible');
    let maxScore = 'A';
    for (let key in quizScores) { if (quizScores[key] > quizScores[maxScore]) maxScore = key; }
    quizFinalProfile = maxScore;
    const results = getQuizResults();
    const result = results[maxScore];
    quizFinalProfileTitle = result.title;
    document.getElementById('quiz-result-title').textContent = result.title + ' - ' + (result.subtitle || '');
    document.getElementById('quiz-result-description').textContent = result.description || '';
    if (contactSection) {
      contactSection.classList.remove('hidden');
      // scroll interno al popup (non della pagina): la sezione contatti è dentro .quiz-modal-container
      const box = document.querySelector('.quiz-modal-container');
      if (box) setTimeout(() => box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' }), 350);
    }
  }

  function validateQuizContactForm() {
    let isValid = true;
    const name = document.getElementById('quiz-contact-name');
    const nameLabel = document.getElementById('quiz-input-label-name');
    const nameError = document.getElementById('quiz-error-name');
    if (!name.value.trim() || name.value.trim().length < 2) { nameLabel.classList.add('error'); nameError.textContent = 'Inserisci un nome valido (min. 2 caratteri)'; isValid = false; } else nameLabel.classList.remove('error');
    const email = document.getElementById('quiz-contact-email');
    const emailLabel = document.getElementById('quiz-input-label-email');
    const emailError = document.getElementById('quiz-error-email');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.value)) { emailLabel.classList.add('error'); emailError.textContent = "Inserisci un'email valida"; isValid = false; } else emailLabel.classList.remove('error');
    const message = document.getElementById('quiz-contact-message');
    const messageLabel = document.getElementById('quiz-input-label-message');
    const messageError = document.getElementById('quiz-error-message');
    if (!message.value.trim()) { messageLabel.classList.add('error'); messageError.textContent = 'Descrivi brevemente la tua situazione'; isValid = false; } else messageLabel.classList.remove('error');
    const privacy = document.getElementById('quiz-contact-privacy');
    if (!privacy.checked) { alert('⚠️ Devi accettare la privacy policy per continuare'); isValid = false; }
    return isValid;
  }

  function handleQuizContactSubmit(e) {
    e.preventDefault();
    if (!validateQuizContactForm()) {
      const firstError = document.querySelector('#quiz-contact-section .error');
      if (firstError) { const firstInput = firstError.querySelector('input, textarea'); if (firstInput) firstInput.focus(); }
      return;
    }
    const submitBtn = document.getElementById('quiz-submit-btn');
    const originalBtnContent = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Invio in corso...';
    submitBtn.disabled = true;
    const results = getQuizResults();
    const profile = results[quizFinalProfile];
    const completeAnalysis = `📊 ANALISI COMPLETA DEL PROFILO\n\n${profile.analysis || 'Analisi non disponibile'}`.trim();
    const templateParams = {
      profile_score: quizFinalProfile,
      profile_title: `${profile.title || ''} - ${profile.subtitle || ''}`,
      profile_description: profile.description || '',
      result: completeAnalysis,
      name: document.getElementById('quiz-contact-name').value.trim(),
      email: document.getElementById('quiz-contact-email').value.trim(),
      phone: document.getElementById('quiz-contact-phone').value.trim() || 'Non specificato',
      message: document.getElementById('quiz-contact-message').value.trim(),
      privacy: 'Accettato',
      sent_from: window.location.href,
      date: new Date().toLocaleString('it-IT'),
      form_type: 'Quiz + Contatti'
    };
    emailjs.send('service_wnyvmph', 'template_wqnveql', templateParams)
      .then(function() {
        const contactSection = document.getElementById('quiz-contact-section');
        const successState = document.getElementById('quiz-success');
        if (contactSection) contactSection.classList.add('hidden');
        if (successState) successState.classList.add('visible');
        submitBtn.innerHTML = originalBtnContent;
        submitBtn.disabled = false;
        if (typeof fbq === 'function') fbq('track', 'Lead');
      })
      .catch(function(error) {
        console.error('❌ EmailJS Error:', error);
        alert('⚠️ Si è verificato un errore durante l\'invio. Riprova o scrivimi su WhatsApp.');
        submitBtn.innerHTML = originalBtnContent;
        submitBtn.disabled = false;
      });
  }

  function openQuizModal() {
    const modal = document.getElementById('quiz-modal');
    if (!modal) return;
    modal.hidden = false;
    if (activeModal) {
      const currentModal = document.getElementById(activeModal);
      if (currentModal) { currentModal.classList.remove('active'); document.body.classList.remove('modal-open'); document.body.style.top = ''; }
    }
    const scrollY = window.scrollY;
    document.documentElement.style.setProperty('--scroll-y', `${scrollY}px`);
    document.body.classList.add('modal-open');
    document.body.style.top = `-${scrollY}px`;
    modal.classList.add('active');
    activeModal = 'quiz-modal';
    document.addEventListener('keydown', handleQuizEscapeKey);
    if (typeof window.resetQuiz === 'function') window.resetQuiz(); else resetQuiz();
    updateQuizProgressPercent();
    setTimeout(() => { const firstQuestion = document.getElementById('quiz-question-text'); if (firstQuestion) firstQuestion.focus(); }, 100);
  }

  function closeQuizModal() {
    const modal = document.getElementById('quiz-modal');
    if (!modal) return;
    modal.classList.remove('active');
    setTimeout(() => { modal.hidden = true; }, 420);
    document.removeEventListener('keydown', handleQuizEscapeKey);
    setTimeout(() => {
      const scrollY = document.documentElement.style.getPropertyValue('--scroll-y');
      document.body.classList.remove('modal-open');
      document.body.style.top = '';
      if (scrollY) window.scrollTo(0, parseInt(scrollY) || 0);
      document.documentElement.style.removeProperty('--scroll-y');
      if (activeModal === 'quiz-modal') activeModal = null;
    }, 400);
  }

  function handleQuizEscapeKey(e) { if (e.key === 'Escape') { e.preventDefault(); closeQuizModal(); } }

  // Etichetta percentuale accanto alla barra di avanzamento del popup
  function updateQuizProgressPercent() {
    const el = document.getElementById('quiz-progress-percent');
    if (!el) return;
    const questions = getQuizQuestions();
    const pct = questions.length ? Math.round(((quizCurrentStep + 1) / questions.length) * 100) : 0;
    el.textContent = Math.min(pct, 100) + '%';
  }

  function resetQuiz() {
    quizCurrentStep = 0;
    ['quiz-error-name','quiz-error-email','quiz-error-message','quiz-error-phone'].forEach(id => { const el=document.getElementById(id); if(el) el.textContent=''; });
    document.querySelectorAll('#quiz-contact-form label.error').forEach(l => l.classList.remove('error'));
    quizScores = { A: 0, B: 0, C: 0, D: 0 };
    quizFinalProfile = '';
    quizFinalProfileTitle = '';
    const questionContainer = document.getElementById('quiz-question-container');
    const resultContainer = document.getElementById('quiz-result-container');
    const contactSection = document.getElementById('quiz-contact-section');
    const successState = document.getElementById('quiz-success');
    questionContainer.classList.remove('hidden');
    resultContainer.classList.remove('visible');
    if (contactSection) contactSection.classList.add('hidden');
    if (successState) successState.classList.remove('visible');
    renderQuizQuestion();
  }

  function initQuizModal() {
    document.querySelectorAll('#quiz-contact-name, #quiz-contact-email, #quiz-contact-message').forEach(input => {
      input.addEventListener('input', function() {
        const label = document.getElementById('quiz-input-label-' + this.name);
        if (label && label.classList.contains('error') && this.validity.valid) label.classList.remove('error');
      });
      input.addEventListener('focus', function() {
        const label = document.getElementById('quiz-input-label-' + this.name);
        if (label) label.classList.remove('error');
      });
    });
    // Bottone "Test gratuito" nella navbar desktop: apre il popup (non va più a test.html)
    document.querySelectorAll('.quiz-open-trigger').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        if (typeof window.closeMobileMenu === 'function') { try { window.closeMobileMenu(); } catch (_) {} }
        openQuizModal();
      });
    });
    const quizOpenButtons = ['iniziatquiz', 'quiz-open-hero'];
    quizOpenButtons.forEach(function(btnId) {
      const btns = document.querySelectorAll('[id="' + btnId + '"]'); // gestisce eventuali id duplicati
      btns.forEach(function(btn) {
        if (!btn) return;
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          // se il menu mobile è aperto, chiudilo prima di mostrare il popup
          if (typeof window.closeMobileMenu === 'function') { try { window.closeMobileMenu(); } catch (_) {} }
          openQuizModal();
        });
      });
    });
    const quizCloseBtn = document.getElementById('quiz-modal-close');
    if (quizCloseBtn) quizCloseBtn.addEventListener('click', closeQuizModal);
    const quizSuccessCloseBtn = document.getElementById('quiz-success-close-btn');
    if (quizSuccessCloseBtn) quizSuccessCloseBtn.addEventListener('click', closeQuizModal);
    const quizModal = document.getElementById('quiz-modal');
    if (quizModal) quizModal.addEventListener('click', function(e) { if (e.target === quizModal) closeQuizModal(); });
    const quizContactForm = document.getElementById('quiz-contact-form');
    if (quizContactForm) quizContactForm.addEventListener('submit', handleQuizContactSubmit);
  }

  // ============================================
  // 5. GLOBAL EXPOSURES (for HTML onclick attributes)
  // ============================================
  // "Leggi di più" delle recensioni: espande il testo COMPLETO in tutte le
  // istanze della stessa recensione (marquee duplica le card con stessi id),
  // senza toccare l'array window.__testimonials.
  window.toggleReviewText = function(index) {
    const textEls = document.querySelectorAll(`#testimonial-text-${index}, [id="testimonial-text-${index}"]`);
    const btnEls  = document.querySelectorAll(`#review-btn-${index}, [id="review-btn-${index}"]`);
    if (!textEls.length || !btnEls.length) return;
    const first = textEls[0];
    const expanded = !first.classList.contains('expanded');
    // Testo preso dall'attributo data-full (o dall'array, se presente): sempre quello completo.
    const fullText = first.getAttribute('data-full') || (window.__testimonials?.[index]?.text) || first.textContent.replace(/^"|"$/g, '');
    textEls.forEach((el) => {
      el.classList.toggle('expanded', expanded);
      el.innerHTML = expanded ? `"${escapeHtml(fullText)}"` : `"${escapeHtml(fullText.substring(0, 150))}${fullText.length > 150 ? '...' : ''}"`;
    });
    btnEls.forEach((btn) => {
      btn.innerHTML = expanded
        ? 'Leggi meno <i class="fa-solid fa-chevron-up"></i>'
        : 'Leggi di più <i class="fa-solid fa-chevron-down"></i>';
    });
  };

  // NOTA: __defaultQuizTitle viene esposto QUI (e non prima), perché la
  // costante defaultConfig è dichiarata più in basso nel blocco: accedervi
  // prima causava un ReferenceError TDZ ("Cannot access 'defaultConfig'
  // before initialization") che abortava l'esecuzione dell'intero script.
  window.__defaultQuizTitle = (defaultConfig.general && defaultConfig.general.quizTitle) || '';

  window.resetQuiz = resetQuiz;
  window.openQuizModal = openQuizModal;
  window.closeQuizModal = closeQuizModal;

  window.dynamicSiteConfig = {
    reload: loadSiteConfigFromFirebase,
    getConfig: () => window.__dynamicConfig || defaultConfig,
    apply: applyConfig
  };

  // ============================================
  // 6. MAIN INITIALIZATION
  // ============================================
  /* ---- Tema personalizzato (salvato dalla dashboard "Colori & stile") ----
     Lettura di site_settings/theme da Firestore e applicazione come variabili
     CSS inline sul <html>, con regole !important per sovrascrivere lo stile.
     Se il documento non esiste o Firestore non è raggiungibile, il sito resta
     con i colori originali di style.css.                                      */
  const THEME_CSS_MAP = {
    pageBg: ['body', '--theme-page-bg', 'background'],
    pageText: ['body', '--theme-page-txt', 'color'],
    heroBg: ['#home', '--theme-hero-bg', 'background'],
    heroText: ['#home', '--theme-hero-txt', 'color'],
    problemsBg: ['#problemi', '--theme-problems-bg', 'background'],
    problemsText: ['#problemi', '--theme-problems-txt', 'color'],
    methodBg: ['#metodo', '--theme-method-bg', 'background'],
    methodText: ['#metodo', '--theme-method-txt', 'color'],
    servicesBg: ['#servizi', '--theme-services-bg', 'background'],
    servicesText: ['#servizi', '--theme-services-txt', 'color'],
    testimonialsBg: ['#testimonials', '--theme-testi-bg', 'background'],
    testimonialsText: ['#testimonials', '--theme-testi-txt', 'color'],
    faqBg: ['#faq-vm', '--theme-faq-bg', 'background'],
    faqText: ['#faq-vm', '--theme-faq-txt', 'color'],
    studioBg: ['#studio', '--theme-studio-bg', 'background'],
    studioText: ['#studio', '--theme-studio-txt', 'color'],
    footerBg: ['footer', '--theme-footer-bg', 'background'],
    footerText: ['footer', '--theme-footer-txt', 'color'],
    // Il tema "card" si applica SOLO alle card dei servizi: le card delle
    // recensioni della Home hanno stile fisso (marquee verde-bosco/avorio).
    cardBg: ['.service-card:not(.featured)', '--theme-card-bg', 'background'],
    cardText: ['.service-card:not(.featured)', '--theme-card-txt', 'color'],
    featCardBg: ['.service-card.featured', '--theme-featcard-bg', 'background'],
    featCardText: ['.service-card.featured', '--theme-featcard-txt', 'color']
  };
  const THEME_BTN_MAP = {
    // Bottoni verdi scuri (CTA "Prenota una sessione", "Acquista il piano", invio moduli…)
    btnPrimaryBg: ['.btn--forest', '--theme-btn1-bg'],
    btnPrimaryText: ['.btn--forest', '--theme-btn1-txt'],
    // Bottoni chiari ("Fai il test gratuito", "Inizia il test")
    btnSecondaryBg: ['.btn--light', '--theme-btn2-bg'],
    btnSecondaryText: ['.btn--light', '--theme-btn2-txt'],
    // Bottoni salvia sulle card ("Prenota in studio", "Prenota online", "Lista d'interesse")
    btnSageBg: ['.btn--sage', '--theme-btnsage-bg'],
    btnSageText: ['.btn--sage', '--theme-btnsage-txt'],
    // Bottone "Prenota" nella navbar + CTA menu mobile
    btnNavBg: ['#bntprenota', '#quiz-open-mm'],
    btnNavText: ['#bntprenota', '#quiz-open-mm']
  };

  function isHex(v) { return /^#[0-9a-fA-F]{3,8}$/.test(String(v || '')); }

  function applySiteTheme(t) {
    if (!t) return;
    const root = document.documentElement;
    let css = '';
    Object.entries(THEME_CSS_MAP).forEach(([key, [sel, varName, prop]]) => {
      if (isHex(t[key])) {
        root.style.setProperty(varName, t[key]);
        const imp = prop === 'background' ? 'background' : prop;
        css += `\n${sel}{ ${imp}: var(${varName}) !important; }`;
        if (prop === 'color') css += `\n${sel} h1,${sel} h2,${sel} h3,${sel} p,${sel} li{ color: inherit; }`;
      }
    });
    Object.entries(THEME_BTN_MAP).forEach(([key, sels]) => {
      if (isHex(t[key])) {
        const part = key.endsWith('Bg') ? 'background' : 'color';
        css += `\n${sels.join(',')}{ ${part}: ${t[key]} !important; }`;
        // colore testo: anche le icone dentro il bottone lo seguono
        if (!key.endsWith('Bg')) css += `\n${sels.map(s => s + ' i').join(',')}{ color: ${t[key]} !important; }`;
      }
    });
    if (css) {
      let st = document.getElementById('site-theme-style');
      if (!st) { st = document.createElement('style'); st.id = 'site-theme-style'; document.head.appendChild(st); }
      st.textContent = css;
    }
  }

  async function loadSiteTheme() {
    try {
      if (!window.firebaseDB || !window.firebaseDoc || !window.firebaseGetDoc) return;
      const snap = await window.firebaseGetDoc(window.firebaseDoc(window.firebaseDB, 'site_settings', 'theme'));
      if (snap && snap.exists()) applySiteTheme(snap.data());
    } catch (e) { console.warn('Tema sito non applicato:', e && e.message); }
  }

  async function initAll() {
    // NOTA: il preloader è avviato da uno script inline in index.html.
    // Qui lo nascondiamo solo come rete di salvataggio se non ha preso il via.
    ensureLoaderHidden();
    loadSiteTheme(); // applica i colori personalizzati salvati dalla dashboard

    // 1. Inizializza UI di base (subito, senza attendere la rete)
    initHeader();
    initMobileMenu();
    initReveal();
    initFaq();
    initRadioCards();
    initCookies();
    initYear();
    initSmoothScroll();
    initCountdown();
    initImageSlider();
    initTestimonials();
    // 2b. Contenuti dinamici dal database (gestiti dalla dashboard admin):
    // se il DB contiene dati, sovrascrivono automaticamente i contenuti statici.
    loadDynamicReviews().then((hasDbReviews) => {
      if (hasDbReviews) initTestimonialsExpand();
    });
    loadDynamicQuizForHome();
    loadDynamicTestPage();
    loadDynamicServices().then(() => { initServiceModal(); });
    initMobileHoverEffects();
    initViewportFix();
    initActiveNav(); // ✅ Gestisce lo stato attivo della navbar
    
    // 3. Inizializza Modali e Funzionalità avanzate
    initAgreementModal();
    // NOTA: initServiceModal() NON va chiamato qui due volte: la seconda
    // registrazione aggiungerebbero listener duplicati sui pulsanti dei
    // pacchetti (doppio click = doppio popup). Viene invocato solo dopo il
    // caricamento dei pacchetti dal database, nella riga sopra.
    initCertModal();
    initContactModal();
    initModeModal();
    initQuizModal();
    initCopyIban();

    console.log('🚀 Valeria Moretti Website inizializzato con successo');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // ============================================================
  //  Bottoni flottanti email / WhatsApp
  //  Protetti con null-check: se il pulsante non esiste nella pagina
  //  corrente, l'errore NON blocca più tutto il resto dello script.
  // ============================================================
  const btnEmail = document.getElementById("Btnemail");
  if (btnEmail) {
    btnEmail.addEventListener("click", function () {
      window.location.href = "mailto:info@webnix.it";
    });
  }

  const btnWhats = document.getElementById("Btnwhats");
  if (btnWhats) {
    btnWhats.addEventListener("click", function () {
      const numero = "393458407102";
      const messaggio = "Ciao! Vorrei avere maggiori informazioni.";
      const link = "https://wa.me/" + numero + "?text=" + encodeURIComponent(messaggio);
      window.open(link, "_blank");
    });
  }

})();


  /* ==========================================================
   FAQ VM — ACCORDION
   Una domanda aperta alla volta
   ========================================================== */

(function () {
  const faqSection = document.getElementById('faq-vm');

  if (!faqSection || faqSection.dataset.faqInitialized === 'true') {
    return;
  }

  faqSection.dataset.faqInitialized = 'true';

  const items = faqSection.querySelectorAll('.faq-vm-item');

  function closeItem(item) {
    const button = item.querySelector('.faq-vm-trigger');
    const answer = item.querySelector('.faq-vm-answer');

    item.classList.remove('is-open');
    button.setAttribute('aria-expanded', 'false');

    // Nasconde la risposta dopo la chiusura visiva.
    answer.hidden = true;
  }

  function openItem(item) {
    const button = item.querySelector('.faq-vm-trigger');
    const answer = item.querySelector('.faq-vm-answer');

    // Chiude le altre risposte.
    items.forEach(function (otherItem) {
      if (otherItem !== item) {
        closeItem(otherItem);
      }
    });

    item.classList.add('is-open');
    button.setAttribute('aria-expanded', 'true');
    answer.hidden = false;
  }

  items.forEach(function (item) {
    const button = item.querySelector('.faq-vm-trigger');

    button.addEventListener('click', function () {
      const isOpen = button.getAttribute('aria-expanded') === 'true';

      if (isOpen) {
        closeItem(item);
      } else {
        openItem(item);
      }
    });
  });
})();