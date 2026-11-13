Afrishine Hub - what to put where
1. Cloudflare (Worker + D1) - REQUIRED for uploads
Workers & Pages > D1 SQL database > Create database (any name, e.g. afrishine-quota).
Open your media Worker > Settings > Bindings > Add > D1 database > Variable name: DB > choose that database.
(The R2 binding MEDIA_BUCKET stays as it is.)
Edit code > paste worker.js > Deploy. The tables are created automatically on the first upload.
Optional variables (Settings > Variables):
REQUIRE_VERIFIED_EMAIL = 1        (email/password accounts must verify their email before uploading)
APPCHECK_PROJECT_NUMBER = 553901207884   (only after App Check is set up, see 3)
ALLOWANCE_BYTES / TOTAL_LIMIT_BYTES (only to change 9.5 GB / 10 GB)
Until DB is connected, uploads are refused safely (the Admin > Storage tab says so).
2. Firebase
Firestore > Rules > paste firestore.rules > Publish.
Firestore > start collection admins > Document ID = your uid (this makes you admin).
App Check (optional but recommended): Build > App Check > register the web app with reCAPTCHA v3, copy the
site key into index.html: window.AF_APPCHECK_SITE_KEY="...". Test, then press Enforce for Firestore.
Push notifications (optional): Project settings > Cloud Messaging > Web Push certificates > Generate key pair,
copy the key into index.html: window.AF_VAPID_KEY="...". Deploy functions/ (Blaze plan).
Authentication > Settings > Authorized domains: afrishinegithubio.vercel.app
3. Vercel (GitHub repository root)
index.html, vercel.json, og-image.png, firebase-messaging-sw.js, api/share.js
(vercel.json routes /share/:kind/:id to api/share.js so WhatsApp shows each post's own preview.)