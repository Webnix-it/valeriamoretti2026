// ============================================
// firebase-config.js
// Configurazione Firebase per Valeria Mental Coach
// Versione: 1.1 - Compatibile con script.js non-module
// ============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 🔥 Configurazione del progetto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDv4CB_l9F3XRjlczYSRANG00jJ1y6UwcM",
  authDomain: "consulting-relazioni.firebaseapp.com",
  projectId: "consulting-relazioni",
  storageBucket: "consulting-relazioni.firebasestorage.app",
  messagingSenderId: "776293586666",
  appId: "1:776293586666:web:e969ed7e846cd0522c6993"
};

// ✅ Inizializza Firebase
const app = initializeApp(firebaseConfig);

// ✅ Inizializza servizi Firebase
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// ✅ Email amministratori autorizzati (per la dashboard admin)
export const ADMIN_EMAILS = ['mentalcoachvaleria@gmail.com'];

// ✅ Export delle funzioni per utilizzo nei moduli (.js con type="module")
export { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  doc, 
  getDoc, 
  setDoc 
};

// ============================================
// 🌍 ESPOSIZIONE GLOBALE PER script.js (NON-MODULE)
// ============================================
// Questo blocco permette a script.js (caricato come script normale)
// di accedere alle funzioni Firebase senza usare import/export

if (typeof window !== 'undefined') {
  // Esponi istanze Firebase
  window.firebaseDB = db;
  window.firebaseAuth = auth;
  window.firebaseApp = app;
  
  // Esponi funzioni Firestore
  window.firebaseDoc = doc;
  window.firebaseGetDoc = getDoc;
  window.firebaseSetDoc = setDoc;
  
  // Esponi funzioni Auth
  window.firebaseSignInWithPopup = signInWithPopup;
  window.firebaseSignOut = signOut;
  window.firebaseOnAuthStateChanged = onAuthStateChanged;
  window.firebaseGoogleProvider = googleProvider;
  
  // Esponi config admin
  window.firebaseADMIN_EMAILS = ADMIN_EMAILS;
  
  console.log('🔓 Firebase esposto a livello globale per script.js');
}

// ✅ Log di conferma
console.log('✅ Firebase configurato correttamente - Project ID:', firebaseConfig.projectId);