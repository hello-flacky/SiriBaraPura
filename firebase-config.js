import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyADJacho9o5tM7uOFxifaxjPrEL_IhtNXU",
    authDomain: "siri-bara-pura.firebaseapp.com",
    projectId: "siri-bara-pura",
    storageBucket: "siri-bara-pura.firebasestorage.app",
    messagingSenderId: "993441804917",
    appId: "1:993441804917:web:0b074214b10726137d3e3c",
    measurementId: "G-Y8X5C3T0XQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage };
