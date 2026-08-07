import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAynnER2cfZghcNtU67xjcphYOxoNA_xK8",
  authDomain: "triple-point-dzp2g.firebaseapp.com",
  projectId: "triple-point-dzp2g",
  storageBucket: "triple-point-dzp2g.firebasestorage.app",
  messagingSenderId: "522226048213",
  appId: "1:522226048213:web:597a1cff77f9a8ada4565c",
  firestoreDatabaseId: "ai-studio-lumenacademytest-72c9e9d8-74da-48e5-a42c-3bb1ced24a0b"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
};
