import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { BrandMark } from './BrandMark';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  function onLogout() {
    logout();
    navigate('/login');
  }

  const initials = user?.nombre
    ? user.nombre.trim().split(/\s+/).slice(0, 2).map((n) => n[0]).join('')
    : '?';

  return (
    <nav className="navbar" aria-label="Barra principal">
      <Link to="/" className="brand">
        <span className="brand-icon">
          <BrandMark size={20} />
        </span>
        <span>miganado</span>
      </Link>
      <div className="nav-spacer" />
      {user && (
        <div className="menu" ref={menuRef}>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <span className="avatar" aria-hidden="true">{initials}</span>
            <span className="hide-mobile" style={{ fontWeight: 500 }}>{user.nombre}</span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          {menuOpen && (
            <div className="menu-list" role="menu">
              <div style={{ padding: '0.5rem 0.65rem 0.4rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{user.nombre}</div>
                <div className="muted" style={{ fontSize: '0.75rem' }}>Doc. {user.documento}</div>
              </div>
              <div className="divider" style={{ margin: '0.25rem 0' }} />
              <button type="button" className="menu-item danger" role="menuitem" onClick={onLogout}>
                <LogOut size={16} aria-hidden="true" />
                Salir
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
