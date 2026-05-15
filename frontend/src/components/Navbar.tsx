import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function onLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="navbar">
      <Link to="/" className="brand">🐂 miganado</Link>
      <div className="row" style={{ gap: '1rem' }}>
        {user && <span style={{ fontSize: '0.9rem' }}>{user.nombre}</span>}
        <button className="btn-secondary" style={{ color: '#1f2a1a' }} onClick={onLogout}>
          Salir
        </button>
      </div>
    </div>
  );
}
