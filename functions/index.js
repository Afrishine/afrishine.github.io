// Firebase Cloud Function: sends a push notification whenever a document is created
// in "notifications" (new message, follow, like, comment). Needs the Blaze plan.
// Deploy:  cd functions && npm install && firebase deploy --only functions
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
admin.initializeApp();

exports.sendPushOnNotification = onDocumentCreated('notifications/{notificationId}', async (event) => {
  const n = event.data && event.data.data();
  if (!n || !n.recipientUid) return;
  const snap = await admin.firestore().collection('pushTokens').where('uid', '==', n.recipientUid).limit(20).get();
  const tokens = snap.docs.map((d) => d.id);
  if (!tokens.length) return;
  const result = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title: n.title || 'Afrishine Hub', body: n.body || 'You have a new update.' },
    webpush: { fcmOptions: { link: 'https://afrishinegithubio.vercel.app/#inbox' } }
  });
  const dead = [];
  result.responses.forEach((r, i) => {
    const code = (r.error && r.error.code) || '';
    if (!r.success && /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(code)) dead.push(tokens[i]);
  });
  await Promise.all(dead.map((t) => admin.firestore().collection('pushTokens').doc(t).delete()));
});
