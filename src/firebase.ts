// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// ✅ Export Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
