import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, serverTimestamp } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Check if any admin exists in the system
    const adminQuery = query(collection(db, "users"), where("role", "==", "ADMIN"));
    const adminSnap = await getDocs(adminQuery);
    const hasAdmin = !adminSnap.empty;

    // Sync with Firestore directly
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    
    let backendData;
    if (!userSnap.exists()) {
      backendData = {
        email: user.email,
        displayName: user.displayName || "User " + user.uid.substring(0, 5),
        avatar: user.photoURL || "",
        bio: "",
        socialLinks: {},
        role: hasAdmin ? "USER" : "ADMIN", // Grant ADMIN to the first participant if no admin exists
        creatorStatus: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedAt: null
      };
      await setDoc(userRef, backendData);
    } else {
      backendData = userSnap.data();
      // If no admin exists in system, auto-upgrade this user to ADMIN
      if (!hasAdmin && backendData.role !== "ADMIN") {
        backendData.role = "ADMIN";
        await updateDoc(userRef, { role: "ADMIN" });
      }
    }
    
    return { user, backendData: { id: user.uid, ...backendData } };
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
};

export const logout = async () => {
  await signOut(auth);
};

