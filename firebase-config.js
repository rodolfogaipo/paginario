/* Configuração do projeto Firebase do Rodolfo — já preenchida */
const firebaseConfig = {
  apiKey: "AIzaSyCI3luIXxvN5m7ZLgfzpBnPQjo7uWp1dnk",
  authDomain: "paginario-52f48.firebaseapp.com",
  databaseURL: "https://paginario-52f48-default-rtdb.firebaseio.com",
  projectId: "paginario-52f48",
  storageBucket: "paginario-52f48.firebasestorage.app",
  messagingSenderId: "881640205059",
  appId: "1:881640205059:web:5df1398b550c3db0821736"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
