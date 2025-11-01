import firebase from 'firebase/app';
import 'firebase/database';
import 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG);


const app = firebase.initializeApp(firebaseConfig);
export const db = firebase.database();
export { firebase };

firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    // User is signed in.
    console.log("User is signed in anonymously with UID:", user.uid);
  } else {
    // User is signed out.
    firebase.auth().signInAnonymously().catch((error) => {
      console.error("Anonymous sign-in failed:", error);
    });
  }
});