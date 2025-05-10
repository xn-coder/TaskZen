
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

// These are the environment variables critical for Firebase to initialize.
// Add or remove variables here as per your project's needs.
const criticalEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  // Uncomment if these services are critical for app startup and should be checked
  // 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  // 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  // 'NEXT_PUBLIC_FIREBASE_APP_ID',
];

const missingVars = criticalEnvVars.filter(key => !process.env[key]);

if (missingVars.length > 0) {
  const errorMessage =
    `Firebase initialization failed: Missing critical environment variables: ${missingVars.join(', ')}. \n` +
    `Please ensure these variables are correctly set in your .env.local file, which must be located in the root directory of your project (same level as package.json).\n` +
    `VERY IMPORTANT: You MUST restart your Next.js development server (e.g., stop the 'npm run dev' command and run it again) after creating or modifying the .env.local file for the changes to take effect.\n` +
    `Double-check the variable names and their values. Refer to the README.md file for detailed setup instructions.\n` +
    `Firebase services will not be available until this is resolved.`;
  console.error(errorMessage);
  // Throw an error to stop the application load if Firebase cannot be initialized.
  // This makes the issue more prominent than just a console log.
  throw new Error(errorMessage);
}

// If we've reached here, all critical environment variables are present.
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const db = getFirestore(app);
// let storage; // If using Firebase Storage

// Connect to emulators if running in development and emulators are configured AND running
// Ensure you have set these NEXT_PUBLIC_ environment variables if you intend to use emulators.
if (process.env.NODE_ENV === 'development') {
  const authEmulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST; // e.g., localhost:9099 or 127.0.0.1:9099
  const firestoreEmulatorHost = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST; // e.g., localhost or 127.0.0.1
  const firestoreEmulatorPort = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT; // e.g., 8080
  // const storageEmulatorHost = process.env.NEXT_PUBLIC_STORAGE_EMULATOR_HOST; // e.g., localhost
  // const storageEmulatorPort = process.env.NEXT_PUBLIC_STORAGE_EMULATOR_PORT; // e.g., 9199

  let emulatorsConfigured = false;

  if (authEmulatorHost) {
    try {
      // Ensure the URL starts with http:// or https://. Default to http if no scheme.
      const authUrl = authEmulatorHost.startsWith('http') ? authEmulatorHost : `http://${authEmulatorHost}`;
      connectAuthEmulator(auth, authUrl, { disableWarnings: true });
      console.log(`Attempting to connect to Auth Emulator at ${authUrl}`);
      emulatorsConfigured = true;
    } catch (e: any) {
      console.warn(`Failed to connect to Firebase Auth emulator using NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST (${authEmulatorHost}). Error: ${e.message}. Ensure it is running or configuration is correct.`);
    }
  }

  if (firestoreEmulatorHost && firestoreEmulatorPort) {
     try {
      const port = parseInt(firestoreEmulatorPort, 10);
      if (isNaN(port)) {
          console.warn(`Invalid Firestore emulator port: ${firestoreEmulatorPort}. Must be a number.`);
      } else {
          connectFirestoreEmulator(db, firestoreEmulatorHost, port);
          console.log(`Attempting to connect to Firestore Emulator at ${firestoreEmulatorHost}:${port}`);
          emulatorsConfigured = true;
      }
    } catch (e: any) {
      console.warn(`Failed to connect to Firebase Firestore emulator using NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST/PORT (${firestoreEmulatorHost}:${firestoreEmulatorPort}). Error: ${e.message}. Ensure it is running or configuration is correct.`);
    }
  }
  
  // Example for Storage Emulator (if used)
  // if (storageEmulatorHost && storageEmulatorPort) {
  //   try {
  //     const port = parseInt(storageEmulatorPort, 10);
  //     if (isNaN(port)) {
  //         console.warn(`Invalid Storage emulator port: ${storageEmulatorPort}. Must be a number.`);
  //     } else {
  //         connectStorageEmulator(storage, storageEmulatorHost, port);
  //         console.log(`Attempting to connect to Storage Emulator at ${storageEmulatorHost}:${port}`);
  //         emulatorsConfigured = true;
  //     }
  //   } catch (e: any) {
  //     console.warn(`Failed to connect to Firebase Storage emulator using NEXT_PUBLIC_STORAGE_EMULATOR_HOST/PORT. Error: ${e.message}. Ensure it is running or configuration is correct.`);
  //   }
  // }

  if (emulatorsConfigured) {
      console.log("Firebase emulators configured based on NEXT_PUBLIC_ environment variables. If connection fails, ensure emulators are actually running at the specified hosts/ports.");
  } else {
      console.log("Firebase Emulators not configured via NEXT_PUBLIC_ environment variables or variables are missing. Connecting to live Firebase services (if configured).");
  }
}


export { app, auth, db /*, storage */ };
