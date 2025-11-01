import firebase from 'firebase/app';
import 'firebase/database';
import 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG);


const app = firebase.initializeApp(firebaseConfig);
export const db = firebase.database();
export { firebase };

export const ensureUserIsAuthenticated = (): Promise<firebase.User> => {
  return new Promise((resolve, reject) => {
    const unsubscribe = firebase.auth().onAuthStateChanged(user => {
      unsubscribe(); // We only need this listener once at startup
      if (user) {
        resolve(user);
      } else {
        firebase.auth().signInAnonymously()
          .then(userCredential => resolve(userCredential.user!))
          .catch(error => reject(error));
      }
    });
  });
};