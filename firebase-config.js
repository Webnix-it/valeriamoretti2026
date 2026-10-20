// ============================================
// firebase-config.js
// Configurazione Firebase per Valeria Mental Coach
// Versione: 1.1 - Compatibile con script.js non-module
// ============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
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
  setDoc,
  deleteDoc,
  collection,
  addDoc,
  getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 🔥 Configurazione del progetto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAnHSIHLCo1A9OaeE30D_2OuYBt0qySGvk",
  authDomain: "mental-coach-2026.firebaseapp.com",
  projectId: "mental-coach-2026",
  storageBucket: "mental-coach-2026.firebasestorage.app",
  messagingSenderId: "562377626085",
  appId: "1:562377626085:web:7806b7c95b50e241b61f0c",
  measurementId: "G-R97QZPGJV3"
};

// ✅ Inizializza Firebase
const app = initializeApp(firebaseConfig);

// ✅ Analytics (opzionale — il measurementId G-R97QZPGJV3 è presente nella config)
try {
  isSupported().then((yes) => {
    if (yes) getAnalytics(app);
  });
} catch (e) {
  // analytics non disponibile: ignora, il resto della app funziona comunque
}

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
  setDoc,
  deleteDoc,
  collection,
  addDoc,
  getDocs 
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
  window.firebaseDeleteDoc = deleteDoc;
  window.firebaseCollection = collection;
  window.firebaseAddDoc = addDoc;
  window.firebaseGetDocs = getDocs;
  
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