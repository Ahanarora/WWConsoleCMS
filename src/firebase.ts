// src/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getAuth } from "firebase/auth";

// -------------------------------------
// Firebase config (public client config)
// -------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyBjOeHP4Pst7BYyRF2c85KKMe6lifXOU1M",
  authDomain: "wwconsole-93f76.firebaseapp.com",
  projectId: "wwconsole-93f76",
  storageBucket: "wwconsole-93f76.appspot.com",
  messagingSenderId: "936183161335",
  appId: "1:936183161335:web:0762f9ac5837ada128cef2",
};


// -------------------------------------
// Initialize app ONCE (critical)
// -------------------------------------
export const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// -------------------------------------
// Export singletons
// -------------------------------------
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app, "asia-south1");
