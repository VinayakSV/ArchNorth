import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDUiz9yfSuGnWZSMZXOtALtk3Di7h9QDVY",
  authDomain: "archnorth-35cf6.firebaseapp.com",
  projectId: "archnorth-35cf6",
  storageBucket: "archnorth-35cf6.firebasestorage.app",
  messagingSenderId: "684708985105",
  appId: "1:684708985105:web:c95adfe6c6f0e76f4ab4b0",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
export const signInWithGoogle = () => signInWithPopup(auth, provider);
export const signOutUser = () => signOut(auth);
