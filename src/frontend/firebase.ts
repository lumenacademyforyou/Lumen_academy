import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAynnER2cfZghcNtU67xjcphYOxoNA_xK8",
  authDomain: "triple-point-dzp2g.firebaseapp.com",
  projectId: "triple-point-dzp2g",
  storageBucket: "triple-point-dzp2g.firebasestorage.app",
  messagingSenderId: "522226048213",
  appId: "1:522226048213:web:597a1cff77f9a8ada4565c"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup, signOut, onAuthStateChanged };
