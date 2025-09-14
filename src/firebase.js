import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDsMe9zoEnywLneW8izil5Y85U5h895ZVU",
  authDomain: "g2-innovation.firebaseapp.com",
  databaseURL: "https://g2-innovation-default-rtdb.firebaseio.com",
  projectId: "g2-innovation",
  storageBucket: "g2-innovation.appspot.com", 
  messagingSenderId: "133319606661",
  appId: "1:133319606661:web:ada76e835cc033854e84ec",
  measurementId: "G-7N0S23TG78"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const db = getDatabase(app);
export const auth = getAuth(app);
export { app };
