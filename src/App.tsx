import React, { useState, useEffect, useMemo } from 'react';
import { MemoryRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy 
} from "firebase/firestore";

import { User, Keluhan, CleaningLog, MaintenanceLog, SecurityLog } from './types';
import { FIREBASE_CONFIG } from './constants';

import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import PublicKeluhan from './pages/PublicKeluhan';
import CleaningChecklist from './pages/CleaningChecklist';
import MaintenancePage from './pages/MaintenancePage';
import SecurityPage from './pages/SecurityPage';
import ComplaintsAdmin from './pages/ComplaintsAdmin';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

// 1. Inisialisasi Firebase menggunakan config dari constants.tsx
const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('pa_user');
    return saved ? JSON.parse(saved) : null;
  });

  // State untuk data dari Firestore
  const [keluhans, setKeluhans] = useState<Keluhan[]>([]);
  const [cleaningLogs, setCleaningLogs] = useState<CleaningLog[]>([]);
  const [maintLogs, setMaintLogs] = useState<MaintenanceLog[]>([]);
  const [secLogs, setSecLogs] = useState<SecurityLog[]>([]);

  // 2. Mengambil data secara Real-time dari Firebase Firestore
  useEffect(() => {
    const q = query(collection(db, "pa_keluhans"), orderBy("timestamp", "desc"));
    return onSnapshot(q, (snapshot) => {
      setKeluhans(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Keluhan[]);
    });
  }, []);

  useEffect(() => {
    const q = query(collection(db, "pa_cleaning"), orderBy("timestamp", "desc"));
    return onSnapshot(q, (snapshot) => {
      setCleaningLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as CleaningLog[]);
    });
  }, []);

  useEffect(() => {
    const q = query(collection(db, "pa_maint"), orderBy("timestamp", "desc"));
    return onSnapshot(q, (snapshot) => {
      setMaintLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as MaintenanceLog[]);
    });
  }, []);

  useEffect(() => {
    const q = query(collection(db, "pa_security"), orderBy("timestamp", "desc"));
    return onSnapshot(q, (snapshot) => {
      setSecLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as SecurityLog[]);
    });
  }, []);

  // 3. Fungsi Handler untuk Sinkronisasi ke Firebase
  const handleAddData = async (collName: string, data: any) => {
    try {
      await addDoc(collection(db, collName), {
        ...data,
        timestamp: data.timestamp || new Date().toISOString()
      });
    } catch (e) { console.error("Error saving to Firebase:", e); }
  };

  const handleUpdateData = async (collName: string, id: string, data: any) => {
    try { await updateDoc(doc(db, collName, id), data); }
    catch (e) { console.error("Error updating Firebase:", e); }
  };

  const handleDeleteData = async (collName: string, id: string) => {
    try { await deleteDoc(doc(db, collName, id)); }
    catch (e) { console.error("Error deleting from Firebase:", e); }
  };

  const handleLogin = (u: User) => {
    setUser(u);
    localStorage.setItem('pa_user', JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('pa_user');
  };

  const pendingComplaints = useMemo(() => {
    return keluhans.filter(k => k.status === 'Menunggu' && !k.isValidated);
  }, [keluhans]);

  const renderProtectedRoute = (Component: React.ElementType, props: any = {}) => {
    if (!user) return <Login onLogin={handleLogin} />;
    return <Component user={user} {...props} />;
  };

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
        {user && <Sidebar user={user} onLogout={handleLogout} />}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {user && <Header user={user} pendingComplaints={pendingComplaints} />}
          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <Routes>
              <Route path="/" element={
                user ? (
                  <Dashboard keluhans={keluhans} cleaning={cleaningLogs} maintenance={maintLogs} security={secLogs} />
                ) : (
                  <PublicKeluhan existingKeluhans={keluhans} onAdd={(k) => handleAddData("pa_keluhans", k)} />
                )
              } />
              <Route path="/public" element={<PublicKeluhan existingKeluhans={keluhans} onAdd={(k) => handleAddData("pa_keluhans", k)} />} />
              <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />} />
              <Route path="/cleaning" element={renderProtectedRoute(CleaningChecklist, { 
                logs: cleaningLogs, 
                onAdd: (l: any) => handleAddData("pa_cleaning", l),
                onUpdate: (logs: any) => console.log("Managed by Firestore") 
              })} />
              <Route path="/maintenance" element={renderProtectedRoute(MaintenancePage, { 
                logs: maintLogs, 
                onAdd: (l: any) => handleAddData("pa_maint", l) 
              })} />
              <Route path="/security" element={renderProtectedRoute(SecurityPage, { 
                logs: secLogs, 
                onAdd: (l: any) => handleAddData("pa_security", l) 
              })} />
              <Route path="/complaints" element={
                user?.role === 'Admin' ? (
                  <ComplaintsAdmin 
                    keluhans={keluhans} 
                    onUpdate={(k) => handleUpdateData("pa_keluhans", k.id, k)} 
                    onDelete={(id) => handleDeleteData("pa_keluhans", id)} 
                  />
                ) : <Navigate to="/" replace />
              } />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
};

export default App;
