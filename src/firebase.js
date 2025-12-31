import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from "firebase/database";
import { getAuth, setPersistence, browserSessionPersistence } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const db = getDatabase(app);
export const auth = getAuth(app);
// Importante: persistencia por pestaña/ventana para permitir múltiples sesiones simultáneas
// (usuario, farmacia, delivery) en diferentes pestañas sin desloguear a las demás.
setPersistence(auth, browserSessionPersistence).catch(() => {
  // En caso de algún error de persistencia (ej. bloqueo de 3rd-party cookies),
  // la app seguirá funcionando con la persistencia por defecto.
});
export const storage = getStorage(app);
export const functions = getFunctions(app); // Usado para callable que elimina usuario de Auth por UID
export { app };
