/* ==================================================
   AFRISHINE HUB — PI NETWORK AUTHENTICATION
   Secure Pi Login Integration
   ================================================== */

const PiAuth = {

  // Initialize Pi SDK
  init() {
    if (!window.Pi) {
      console.warn("Pi SDK is not available yet.");
      return false;
    }

    try {
      window.Pi.init({
        version: "2.0",
        sandbox: false
      });

      console.log("Pi SDK initialized.");
      return true;

    } catch (error) {
      console.error("Pi SDK initialization error:", error);
      return false;
    }
  },


  // Login with Pi
  async login() {

    if (!window.Pi) {
      alert("Please open Afrishine Hub inside Pi Browser.");
      return;
    }

    try {

      const scopes = ["username"];

      const authResult = await window.Pi.authenticate(
        scopes,
        this.onIncompletePaymentFound
      );

      if (!authResult || !authResult.accessToken) {
        throw new Error("Pi authentication was not completed.");
      }

      // Store temporary token in memory only.
      // Never treat username alone as proof of identity.
      window.piAccessToken = authResult.accessToken;

      window.currentUser = {
        provider: "pi",
        uid: String(authResult.user.uid),
        username: authResult.user.username
      };

      window.dispatchEvent(
        new CustomEvent("afrishine-user-ready", {
          detail: {
            user: window.currentUser,
            provider: "pi"
          }
        })
      );

      if (typeof window.closeAuthModal === "function") {
        window.closeAuthModal();
      }

      console.log("Pi login completed. Server verification is still required.");

      return authResult;

    } catch (error) {

      console.error("Pi Login failed:", error);

      alert(
        "Pi Login failed. Please try again inside Pi Browser."
      );

      return null;
    }
  },


  // Payment callback placeholder
  onIncompletePaymentFound(payment) {
    console.log("Incomplete Pi payment detected:", payment);
  }

};


// Public login function for the app
window.loginWithPi = function () {
  return PiAuth.login();
};


// Initialize when Pi SDK becomes available
document.addEventListener("DOMContentLoaded", () => {
  PiAuth.init();
});


// Export
window.PiAuth = PiAuth;