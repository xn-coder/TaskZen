
import { auth, db } from './firebase';
import type { Profile } from './types';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile as updateFirebaseProfile,
  type User as FirebaseAuthUser,
  type AuthError
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

export interface AppUser extends FirebaseAuthUser {
  profile: Profile | null;
}

async function fetchUserProfile(uid: string): Promise<Profile | null> {
  if (!uid) return null;
  try {
    const profileDocRef = doc(db, 'profiles', uid);
    const profileSnap = await getDoc(profileDocRef);
    if (profileSnap.exists()) {
      return { id: profileSnap.id, ...profileSnap.data() } as Profile;
    } else {
      console.warn(`No profile found for user UID: ${uid}`);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching profile for UID ${uid}:`, error);
    return null; // Graceful degradation
  }
}

async function firebaseUserToAppUser(firebaseUser: FirebaseAuthUser | null): Promise<AppUser | null> {
  if (!firebaseUser) return null;
  const profile = await fetchUserProfile(firebaseUser.uid);
  return {
    ...firebaseUser,
    // Manually copy over properties that might not be spread correctly or need type assertion
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    emailVerified: firebaseUser.emailVerified,
    isAnonymous: firebaseUser.isAnonymous,
    metadata: firebaseUser.metadata,
    providerData: firebaseUser.providerData,
    providerId: firebaseUser.providerId,
    tenantId: firebaseUser.tenantId,
    refreshToken: firebaseUser.refreshToken,
    delete: firebaseUser.delete,
    getIdToken: firebaseUser.getIdToken,
    getIdTokenResult: firebaseUser.getIdTokenResult,
    reload: firebaseUser.reload,
    toJSON: firebaseUser.toJSON,
    // End of manual copy
    profile: profile,
  };
}


export const getCurrentUser = (): Promise<AppUser | null> => {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubscribe(); // Unsubscribe after first check
      if (firebaseUser) {
        try {
          const appUser = await firebaseUserToAppUser(firebaseUser);
          resolve(appUser);
        } catch (error) {
          console.error("Error processing current user:", error);
          reject(error);
        }
      } else {
        resolve(null);
      }
    }, (error) => {
      unsubscribe();
      console.error("Error in onAuthStateChanged for getCurrentUser:", error);
      reject(error);
    });
  });
};

export const login = async (email: string, password: string): Promise<AppUser> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const appUser = await firebaseUserToAppUser(userCredential.user);
    if (!appUser) throw new Error("Login successful but failed to process user data.");
    return appUser;
  } catch (error) {
    console.error("Firebase login error:", error);
    const authError = error as AuthError;
    // Provide more user-friendly messages for common errors
    if (authError.code === 'auth/user-not-found' || authError.code === 'auth/wrong-password' || authError.code === 'auth/invalid-credential') {
      throw new Error("Invalid email or password. Please try again.");
    }
    throw new Error(authError.message || "An unknown login error occurred.");
  }
};

export const register = async (name: string, email: string, password: string): Promise<AppUser> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // Update Firebase Auth user profile with display name
    await updateFirebaseProfile(firebaseUser, { displayName: name });

    // Create user profile document in Firestore
    const profileData: Omit<Profile, 'id'> = {
      name: name,
      email: firebaseUser.email || '', // email should exist
      avatar_url: firebaseUser.photoURL || '', // Can be updated later
      // Firebase Timestamps are handled by Firestore, not needed here.
    };
    const profileDocRef = doc(db, 'profiles', firebaseUser.uid);
    await setDoc(profileDocRef, profileData);
    
    const appUser = await firebaseUserToAppUser(firebaseUser);
    if (!appUser) throw new Error("Registration successful but failed to process user data.");
    return appUser;
  } catch (error) {
    console.error("Firebase registration error:", error);
    const authError = error as AuthError;
     if (authError.code === 'auth/email-already-in-use') {
      throw new Error("This email address is already in use. Please try another.");
    }
    throw new Error(authError.message || "An unknown registration error occurred.");
  }
};

export const logout = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Firebase logout error:", error);
    const authError = error as AuthError;
    throw new Error(authError.message || "An unknown logout error occurred.");
  }
};

export const onAuthStateChangeCallback = (callback: (user: AppUser | null) => void) => {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      const appUser = await firebaseUserToAppUser(firebaseUser);
      callback(appUser);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error("Error in onAuthStateChanged subscription:", error);
    callback(null); // Notify callback about the error state
  });
};

// Renaming onAuthStateChange to onAuthStateChangeCallback to avoid conflict with firebase/auth onAuthStateChanged
// This exported function will be used in AuthContext.tsx
export { onAuthStateChanged as firebaseOnAuthStateChanged } from 'firebase/auth';
