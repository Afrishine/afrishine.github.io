/* ==================================================
   AFRISHINE HUB — FIREBASE CONNECTION
   Your Hub, Your Solutions
   ================================================== */

// 1. Import Firebase SDK
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


// 2. Your Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBnrdoguyhUd_E3I5RHqcXHNVLa6kIMX4",
  authDomain: "afrishine-hub.firebaseapp.com",
  projectId: "afrishine-hub",
  storageBucket: "afrishine-hub.firebasestorage.app",
  messagingSenderId: "553901207884",
  appId: "1:553901207884:web:81d4dce86149267ae59fe9",
  measurementId: "G-WXNG0SHM9X"
};


// 3. Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);


// 4. Initialize Firebase Services
const auth = getAuth(firebaseApp);

const db = getFirestore(firebaseApp);

const storage = getStorage(firebaseApp);


// 5. Track Firebase User
let currentFirebaseUser = null;

onAuthStateChanged(auth, (user) => {
  currentFirebaseUser = user;

  // Shared login state for Afrishine Hub
  window.currentUser = user || null;

  console.log(
    user
      ? "Afrishine Hub: User signed in."
      : "Afrishine Hub: No user signed in."
  );

  // Notify other app modules
  window.dispatchEvent(
    new CustomEvent("firebase-auth-changed", {
      detail: { user }
    })
  );
});


// 6. Export Firebase Services
export {
  firebaseApp,
  auth,
  db,
  storage,
  currentFirebaseUser
};

console.log("Afrishine Hub Firebase initialized.");