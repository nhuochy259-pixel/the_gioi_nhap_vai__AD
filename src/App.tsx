/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { doc, getDoc, updateDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { useAuthStore } from './store/useAuthStore';
import { Toaster } from 'react-hot-toast';

import Layout from './components/layout/Layout';
import Welcome from './pages/Welcome';
import Home from './pages/Home';
import Profile from './pages/Profile';
import AISearch from './pages/AISearch';
import CreatorDashboard from './pages/CreatorDashboard';
import Prompts from './pages/Prompts';
import Feedbacks from './pages/Feedbacks';
import Explore from './pages/Explore';
import Characters from './pages/Characters';
import Creators from './pages/Creators';
import Notifications from './pages/Notifications';
import Contact from './pages/Contact';
import Settings from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';
import DashboardStats from './pages/admin/DashboardStats';
import UserManagement from './pages/admin/UserManagement';
import ReportQueue from './pages/admin/ReportQueue';
import AuditLogs from './pages/admin/AuditLogs';
import BadgeManager from './pages/admin/BadgeManager';
import SupportManager from './pages/admin/SupportManager';
import AdminModeratorManager from './pages/admin/AdminModeratorManager';
import CreatorManager from './pages/admin/CreatorManager';
import CreatorDetail from './pages/CreatorDetail';
import CharacterDetail from './pages/CharacterDetail';
import PromptDetail from './pages/PromptDetail';
import { initThemeAndFont, applyTheme } from './lib/themeFont';
import ProtectedRoute from './components/auth/ProtectedRoute';

export default function App() {
  const { setAuth, setInitialized } = useAuthStore();

  useEffect(() => {
    initThemeAndFont();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);

          // Check if any admin exists in the system
          const adminQuery = query(collection(db, "users"), where("role", "==", "ADMIN"));
          const adminSnap = await getDocs(adminQuery);
          const hasAdmin = !adminSnap.empty;

          if (userSnap.exists()) {
            let userData = userSnap.data();
            // If no admin exists in the system, auto-upgrade the current user to ADMIN
            if (!hasAdmin && userData.role !== 'ADMIN') {
              await updateDoc(userRef, { role: 'ADMIN' });
              userData.role = 'ADMIN';
            }
            if (userData.themePreference) {
              applyTheme(userData.themePreference);
            }
            setAuth(firebaseUser, { id: firebaseUser.uid, ...userData } as any);
          } else {
            // First time profile creation in auth listener
            const { generateUniqueId } = await import('./lib/generateId');
            const numericId = await generateUniqueId(db, 'user', firebaseUser.uid);
            
            const newUserData = {
              numericId,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || "User " + firebaseUser.uid.substring(0, 5),
              avatar: firebaseUser.photoURL || "",
              bio: "",
              socialLinks: {},
              role: hasAdmin ? "USER" : "ADMIN",
              creatorStatus: false,
              isLocked: false,
              strikeCount: 0,
              badges: [],
              permissions: hasAdmin ? [] : ["ALL"],
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              deletedAt: null
            };
            await updateDoc(userRef, newUserData).catch(async () => {
              const { setDoc } = await import('firebase/firestore');
              await setDoc(userRef, newUserData);
            });
            setAuth(firebaseUser, { id: firebaseUser.uid, ...newUserData } as any);
          }
        } catch (e) {
          console.error("Failed to fetch user profile", e);
          setAuth(firebaseUser, null);
        }
      } else {
        setAuth(null, null);
      }
      setInitialized(true);
    });

    return () => unsubscribe();
  }, []);

  return (
    <BrowserRouter>
      <Toaster position="top-center" />
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/welcome" element={<Welcome />} />
        
        <Route element={<Layout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/characters" element={<Characters />} />
          <Route path="/creators" element={<Creators />} />
          <Route path="/ai-search" element={<AISearch />} />
          <Route path="/prompts" element={<Prompts />} />
          <Route path="/feedbacks" element={<Feedbacks />} />
          <Route path="/feedback" element={<Feedbacks />} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/creator/dashboard" element={<ProtectedRoute><CreatorDashboard /></ProtectedRoute>} />
          <Route path="/creator/:id" element={<CreatorDetail />} />
          <Route path="/character/:id" element={<CharacterDetail />} />
          <Route path="/prompt/:id" element={<PromptDetail />} />
          <Route path="/admin" element={<ProtectedRoute><DashboardStats /></ProtectedRoute>} />
          <Route path="/admin/dashboard" element={<ProtectedRoute><DashboardStats /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
          <Route path="/admin/reports" element={<ProtectedRoute><ReportQueue /></ProtectedRoute>} />
          <Route path="/admin/audit" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
          <Route path="/admin/badges" element={<ProtectedRoute><BadgeManager /></ProtectedRoute>} />
          <Route path="/admin/support" element={<ProtectedRoute><SupportManager /></ProtectedRoute>} />
          <Route path="/admin/managers" element={<ProtectedRoute><AdminModeratorManager /></ProtectedRoute>} />
          <Route path="/admin/creators" element={<ProtectedRoute><CreatorManager /></ProtectedRoute>} />
          <Route path="/admin/content" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          {/* Add more routes later */}
          <Route path="*" element={<div className="p-8 text-center">404 - Not Found</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

