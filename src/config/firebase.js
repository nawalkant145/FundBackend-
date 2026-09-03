                                                 
                                                                        

let admin = null;
let initialized = false;

const initFirebase = () => {
  if (initialized) return admin;

  const { FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL } =
    process.env;

  if (!FIREBASE_PROJECT_ID || !FIREBASE_PRIVATE_KEY || !FIREBASE_CLIENT_EMAIL) {
    console.warn("⚠️  Firebase env not set — FCM push notifications disabled");
    initialized = true;
    return null;
  }

  try {
    admin = require("firebase-admin");
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        clientEmail: FIREBASE_CLIENT_EMAIL,
      }),
    });
    console.log("✅ Firebase Admin initialized");
  } catch (err) {
    console.error("❌ Firebase init failed:", err.message);
    admin = null;
  }
  initialized = true;
  return admin;
};

module.exports = { initFirebase, getAdmin: () => admin };
