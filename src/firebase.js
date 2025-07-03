// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBjuRo7CA5EgrNxxLG6Uuma5-cyITbIWyE",
  authDomain: "app-luthier-1813e.firebaseapp.com",
  projectId: "app-luthier-1813e",
  storageBucket: "app-luthier-1813e.firebasestorage.app",
  messagingSenderId: "1082392387607",
  appId: "1:1082392387607:web:3b292978d0c77c24e8bc52"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  host: "firestore.googleapis.com",
  ssl: true,
});
export const storage = getStorage(app);