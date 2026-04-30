// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDUiz9yfSuGnWZSMZXOtALtk3Di7h9QDVY",
  authDomain: "archnorth-35cf6.firebaseapp.com",
  projectId: "archnorth-35cf6",
  storageBucket: "archnorth-35cf6.firebasestorage.app",
  messagingSenderId: "684708985105",
  appId: "1:684708985105:web:c95adfe6c6f0e76f4ab4b0",
  measurementId: "G-KV2EWVESSR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);