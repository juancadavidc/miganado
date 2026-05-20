import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Navbar } from './components/Navbar';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoteFormPage } from './pages/LoteFormPage';
import { LoteImportPage } from './pages/LoteImportPage';
import { LoteDetallePage } from './pages/LoteDetallePage';
import { PotrerosPage } from './pages/PotrerosPage';

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container">Cargando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <>
      {user && <Navbar />}
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
        <Route path="/registro" element={user ? <Navigate to="/" /> : <RegisterPage />} />
        <Route
          path="/"
          element={
            <Protected>
              <DashboardPage />
            </Protected>
          }
        />
        <Route
          path="/lotes/nuevo"
          element={
            <Protected>
              <LoteFormPage />
            </Protected>
          }
        />
        <Route
          path="/lotes/importar"
          element={
            <Protected>
              <LoteImportPage />
            </Protected>
          }
        />
        <Route
          path="/lotes/:id"
          element={
            <Protected>
              <LoteDetallePage />
            </Protected>
          }
        />
        <Route
          path="/potreros"
          element={
            <Protected>
              <PotrerosPage />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
