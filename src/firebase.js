// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from "firebase/database";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDsMe9zoEnywLneW8izil5Y85U5h895ZVU",
  authDomain: "g2-innovation.firebaseapp.com",
  databaseURL: "https://g2-innovation-default-rtdb.firebaseio.com",
  projectId: "g2-innovation",
  storageBucket: "g2-innovation.firebasestorage.app",
  messagingSenderId: "133319606661",
  appId: "1:133319606661:web:ada76e835cc033854e84ec",
  measurementId: "G-7N0S23TG78"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Exportar la instancia de la base de datos
export const db = getDatabase(app);