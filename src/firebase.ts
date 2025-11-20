// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getAuth } from "firebase/auth";


// ✅ Your actual Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyBjOeHP4Pst7BYyRF2c85KKMe6lifXOU1M",
  authDomain: "wwconsole-93f76.firebaseapp.com",
  projectId: "wwconsole-93f76",
  storageBucket: "wwconsole-93f76.appspot.com", // ⚠️ fix: should be .appspot.com
  messagingSenderId: "936183161335",
  appId: "1:936183161335:web:0762f9ac5837ada128cef2",
  measurementId: "G-H6R483JTGT"
};

// ✅ Export Firebase services
export const app = initializeApp(firebaseConfig);  // ✅ <--- add this export
export const db = getFirestore(app);
export const functions = getFunctions(app, "asia-south1");
export const auth = getAuth(app);