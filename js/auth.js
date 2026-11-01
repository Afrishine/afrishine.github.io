/* ==================================================
   AFRISHINE HUB — EMAIL AUTHENTICATION
   Your Hub, Your Solutions
   ================================================== */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import { auth } from "./firebase.js";


// ================================================
// 1. CREATE AUTH MODAL
// ================================================

function createAuthModal() {
  if (document.getElementById("authModal")) return;

  const modal = document.createElement("div");

  modal.id = "authModal";
  modal.className = "modal";

  modal.innerHTML = `
    <div class="modal-content">

      <button
        type="button"
        id="closeAuthModal"
        class="btn btn-outline"
        style="float:right"
      >
        ✕
      </button>

      <div style="clear:both"></div>

      <h2 id="authTitle">Welcome to Afrishine Hub</h2>

      <p id="authDescription">
        Sign in to connect, share and grow with our community.
      </p>

      <div id="authError"
        style="color:#e05252;margin-bottom:12px">
      </div>

      <div id="authSuccess"
        style="color:#25b879;margin-bottom:12px">
      </div>

      <form id="emailLoginForm">

        <label>Email Address</label>
        <input
          type="email"
          id="loginEmail"
          placeholder="Enter your email"
          autocomplete="email"
          required
        >

        <label>Password</label>
        <input
          type="password"
          id="loginPassword"
          placeholder="Enter your password"
          autocomplete="current-password"
          minlength="6"
          required
        >

        <button class="btn btn-block" type="submit">
          Login with Email
        </button>

      </form>

      <form id="emailSignupForm" style="display:none">

        <label>Full Name</label>
        <input
          type="text"
          id="signupName"
          placeholder="Enter your full name"
          autocomplete="name"
          required
        >

        <label>Email Address</label>
        <input
          type="email"
          id="signupEmail"
          placeholder="Enter your email"
          autocomplete="email"
          required
        >

        <label>Password</label>
        <input
          type="password"
          id="signupPassword"
          placeholder="Create a password"
          autocomplete="new-password"
          minlength="6"
          required
        >

        <label>Confirm Password</label>
        <input
          type="password"
          id="confirmPassword"
          placeholder="Confirm your password"
          autocomplete="new-password"
          minlength="6"
          required
        >

        <button class="btn btn-gold btn-block" type="submit">
          Create Account
        </button>

      </form>

      <p style="margin-top:15px;text-align:center">
        <button
          type="button"
          id="forgotPassword"
          class="btn btn-outline btn-block"
        >
          Forgot Password?
        </button>
      </p>

      <p style="text-align:center;margin-top:15px">
        <span id="authSwitchText">Don't have an account?</span>

        <button
          type="button"
          id="authSwitchButton"
          class="btn btn-outline"
        >
          Sign Up
        </button>
      </p>

      <div style="margin-top:18px;text-align:center">
        <button
          type="button"
          id="piLoginButton"
          class="btn btn-gold btn-block"
        >
          π Login with Pi
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("closeAuthModal")
    .addEventListener("click", closeAuthModal);

  document.getElementById("authSwitchButton")
    .addEventListener("click", switchAuthMode);

  document.getElementById("emailLoginForm")
    .addEventListener("submit", loginWithEmail);

  document.getElementById("emailSignupForm")
    .addEventListener("submit", signupWithEmail);

  document.getElementById("forgotPassword")
    .addEventListener("click", resetPassword);

  document.getElementById("piLoginButton")
    .addEventListener("click", () => {
      closeAuthModal();

      if (typeof window.loginWithPi === "function") {
        window.loginWithPi();
      } else {
        showAuthMessage(
          "Pi Login is being connected. Please try again later."
        );
      }
    });
}


// ================================================
// 2. OPEN AND CLOSE MODAL
// ================================================

window.openAuthModal = function () {
  createAuthModal();

  const modal = document.getElementById("authModal");

  modal.classList.add("show");

  clearAuthMessages();
};


function closeAuthModal() {
  const modal = document.getElementById("authModal");

  if (modal) {
    modal.classList.remove("show");
  }
}

window.closeAuthModal = closeAuthModal;


// ================================================
// 3. SWITCH LOGIN AND SIGNUP
// ================================================

function switchAuthMode() {
  const loginForm =
    document.getElementById("emailLoginForm");

  const signupForm =
    document.getElementById("emailSignupForm");

  const title =
    document.getElementById("authTitle");

  const description =
    document.getElementById("authDescription");

  const switchButton =
    document.getElementById("authSwitchButton");

  const switchText =
    document.getElementById("authSwitchText");

  const isLoginVisible =
    loginForm.style.display !== "none";

  loginForm.style.display =
    isLoginVisible ? "none" : "block";

  signupForm.style.display =
    isLoginVisible ? "block" : "none";

  title.textContent = isLoginVisible
    ? "Create Your Account"
    : "Welcome Back";

  description.textContent = isLoginVisible
    ? "Join the Afrishine Hub community."
    : "Sign in to continue.";

  switchButton.textContent = isLoginVisible
    ? "Login"
    : "Sign Up";

  switchText.textContent = isLoginVisible
    ? "Already have an account?"
    : "Don't have an account?";

  clearAuthMessages();
}


// ================================================
// 4. SIGN UP WITH EMAIL
// ================================================

async function signupWithEmail(event) {
  event.preventDefault();

  clearAuthMessages();

  const name =
    document.getElementById("signupName").value.trim();

  const email =
    document.getElementById("signupEmail").value.trim();

  const password =
    document.getElementById("signupPassword").value;

  const confirmPassword =
    document.getElementById("confirmPassword").value;

  if (password.length < 6) {
    showAuthMessage("Password must have at least 6 characters.");
    return;
  }

  if (password !== confirmPassword) {
    showAuthMessage("Passwords do not match.");
    return;
  }

  try {
    const result = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    await updateProfile(result.user, {
      displayName: name
    });

    window.currentUser = result.user;

    showAuthMessage(
      "Your Afrishine Hub account has been created.",
      true
    );

    closeAuthModal();

    window.dispatchEvent(
      new CustomEvent("afrishine-user-ready", {
        detail: { user: result.user }
      })
    );

  } catch (error) {
    showAuthMessage(getFriendlyError(error));
  }
}


// ================================================
// 5. LOGIN WITH EMAIL
// ================================================

async function loginWithEmail(event) {
  event.preventDefault();

  clearAuthMessages();

  const email =
    document.getElementById("loginEmail").value.trim();

  const password =
    document.getElementById("loginPassword").value;

  try {
    const result = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    window.currentUser = result.user;

    showAuthMessage(
      "You are now logged in.",
      true
    );

    closeAuthModal();

    window.dispatchEvent(
      new CustomEvent("afrishine-user-ready", {
        detail: { user: result.user }
      })
    );

  } catch (error) {
    showAuthMessage(getFriendlyError(error));
  }
}


// ================================================
// 6. FORGOT PASSWORD
// ================================================

async function resetPassword() {
  clearAuthMessages();

  const email = document.getElementById("loginEmail").value.trim();

  if (!email) {
    showAuthMessage("Enter your email address first.");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);

    showAuthMessage(
      "Password reset instructions have been sent to your email.",
      true
    );

  } catch (error) {
    showAuthMessage(getFriendlyError(error));
  }
}


// ================================================
// 7. LOGOUT
// ================================================

window.afrishineLogout = async function () {
  try {
    await signOut(auth);

    window.currentUser = null;

    window.dispatchEvent(
      new CustomEvent("afrishine-user-logged-out")
    );

    showAuthMessage("You have logged out.", true);

  } catch (error) {
    console.error("Logout error:", error);
  }
};


// ================================================
// 8. ERROR AND SUCCESS MESSAGES
// ================================================

function showAuthMessage(message, success = false) {
  const errorBox = document.getElementById("authError");
  const successBox = document.getElementById("authSuccess");

  if (!errorBox || !successBox) return;

  errorBox.textContent = success ? "" : message;
  successBox.textContent = success ? message : "";
}


function clearAuthMessages() {
  const errorBox = document.getElementById("authError");
  const successBox = document.getElementById("authSuccess");

  if (errorBox) errorBox.textContent = "";
  if (successBox) successBox.textContent = "";
}


function getFriendlyError(error) {
  const messages = {
    "auth/email-already-in-use":
      "This email already has an account. Please login.",

    "auth/invalid-email":
      "Please enter a valid email address.",

    "auth/weak-password":
      "Please choose a stronger password.",

    "auth/invalid-credential":
      "Incorrect email or password.",

    "auth/network-request-failed":
      "Network error. Check your internet connection."
  };

  return messages[error.code] ||
    "Something went wrong. Please try again.";
}


// ================================================
// 9. INITIALIZE AUTHENTICATION
// ================================================

document.addEventListener("DOMContentLoaded", () => {
  createAuthModal();
});

console.log("Afrishine Hub Email Authentication loaded.");