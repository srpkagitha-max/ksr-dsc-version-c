 import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

const $ = (id) => document.getElementById(id);

window.adminLogin = async function () {
  try {
    await signInWithEmailAndPassword(
      auth,
      $("email").value.trim(),
      $("pass").value
    );
    alert("Login success");
  } catch (e) {
    alert("Login failed: " + e.message);
  }
};

window.logout = function () {
  signOut(auth);
};

onAuthStateChanged(auth, (user) => {
  $("loginCard")?.classList.toggle("hide", !!user);
  $("panel")?.classList.toggle("hide", !user);
});
