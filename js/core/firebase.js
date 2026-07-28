// Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

import {
  getDatabase
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

export const firebaseConfig = {
  apiKey: "AIzaSyBmkXqMaQrxpLUw26V7pxx-7lK84ShphuM",
  authDomain: "test-c812f.firebaseapp.com",
  databaseURL: "https://test-c812f-default-rtdb.firebaseio.com",
  projectId: "test-c812f",
  storageBucket: "test-c812f.firebasestorage.app",
  messagingSenderId: "677589777900",
  appId: "1:677589777900:web:25394f2b5bcb5f410a94c9"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const auth = getAuth(app);