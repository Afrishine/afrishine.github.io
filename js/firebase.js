/* ==================================================
   AFRISHINE HUB — FIREBASE CONFIGURATION
   Your Hub, Your Solutions
   ================================================== */

// Firebase SDK imports
import { initializeApp }
  from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

import {
  getStorage
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js";


// 1. Firebase Configuration
// Tuzashyiramo amakuru ya project yawe
// avuye muri Firebase Console.

const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_AUTH_DOMAIN",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_STORAGE_BUCKET",
  messagingSenderId: "PASTE_YOUR_MESSAGING_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};


// 2. Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);


// 3. Initialize Firebase Services
const auth = getAuth(firebaseApp);

const db = getFirestore(firebaseApp);

const storage = getStorage(firebaseApp);


// 4. Current User
let currentFirebaseUser = null;

onAuthStateChanged(auth, (user) => {
  currentFirebaseUser = user;

  window.currentUser = user || null;

  console.log(
    user
      ? "Afrishine Hub user is signed in."
      : "No user is signed in."
  );
});


// 5. Export Services
export {
  firebaseApp,
  auth,
  db,
  storage,
  currentFirebaseUser
};