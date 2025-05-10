
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
// import { getStorage, connectStorageEmulator } from 'firebase/storage'; // If using Firebase Storage

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional
};

const criticalEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  // 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', // Uncomment if storage is critical
  // 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', // Uncomment if messaging is critical
  // 'NEXT_PUBLIC_FIREBASE_APP_ID', // Uncomment if app ID is critical
];

const missingVars = criticalEnvVars.filter(key => !process.env[key]);

let app;
let auth;
let db;
// let storage; // If using Firebase Storage

if (missingVars.length > 0) {
  console.error(
    `Firebase initialization failed: Missing critical environment variables: ${missingVars.join(', ')}. ` +
    `Please ensure these are set in your .env.local file. Refer to README.md for setup instructions. ` +
    `Firebase services will not be available.`
  );
  // Set app, auth, db to null or handle appropriately to prevent app crash
  // For now, they will be undefined, and subsequent calls will fail,
  // which is acceptable as the console error clearly indicates the setup issue.
} else {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }

  auth = getAuth(app);
  db = getFirestore(app);
  // storage = getStorage(app); // If using Firebase Storage

  // Connect to emulators if running in development and emulators are running
  if (process.env.NODE_ENV === 'development') {
    // Check if emulators are running (optional, simple check)
    // Note: For a more robust check, you might ping the emulator ports
    const emulatorsRunning = process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST;

    if (emulatorsRunning) {
        console.log("Connecting to Firebase Emulators");
      try {
        // Default emulator ports
        connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
        connectFirestoreEmulator(db, 'localhost', 8080);
        // connectStorageEmulator(storage, 'localhost', 9199); // If using Storage Emulator
      } catch (error) {
        console.warn("Failed to connect to Firebase emulators. Ensure they are running or disable emulator connection in firebase.ts.", error);
      }
    } else {
        console.log("Firebase Emulators not detected or not configured. Connecting to live Firebase services.");
    }
  }
}

export { app, auth, db /*, storage */ };
