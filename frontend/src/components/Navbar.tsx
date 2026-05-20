import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, ChevronDown, Menu, X, Beef, Fence } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { BrandMark } from './BrandMark';

const NAV_ITEMS = [
  { to: '/', label: 'Lotes', icon: Beef, end: true },
  { to: '/potreros', label: 'Potreros', icon: Fence, end: false },
];

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  // Cerrar el drawer al navegar y bloquear el scroll del body mientras está abierto.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDrawerOpen(false);
    }
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [drawerOpen]);

  function onLogout() {
    logout();
    navigate('/login');
  }

  const initials = user?.nombre
    ? user.nombre.trim().split(/\s+/).slice(0, 2).map((n) => n[0]).join('')
    : '?';

  return (
    <>
      <nav className="navbar" aria-label="Barra principal">
        {user && (
          <button
            type="button"
            className="btn-ghost btn-icon nav-burger"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menú"
            aria-expanded={drawerOpen}
          >
            <Menu size={20} aria-hidden="true" />
          </button>
        )}
        <Link to="/" className="brand">
          <span className="brand-icon">
            <BrandMark size={20} />
          </span>
          <span>miganado</span>
        </Link>
        {user && (
          <div className="nav-links">
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </div>
        )}
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

      {user && drawerOpen && (
        <div
          className="drawer-scrim"
          onClick={(e) => { if (e.target === e.currentTarget) setDrawerOpen(false); }}
        >
          <aside className="drawer" role="dialog" aria-modal="true" aria-label="Menú de navegación">
            <div className="drawer-head">
              <span className="brand">
                <span className="brand-icon"><BrandMark size={20} /></span>
                <span>miganado</span>
              </span>
              <button
                type="button"
                className="btn-ghost btn-icon"
                onClick={() => setDrawerOpen(false)}
                aria-label="Cerrar menú"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <nav className="drawer-links" aria-label="Secciones">
              {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) => `drawer-link${isActive ? ' active' : ''}`}
                  onClick={() => setDrawerOpen(false)}
                >
                  <Icon size={18} aria-hidden="true" />
                  {label}
                </NavLink>
              ))}
            </nav>

            <div className="nav-spacer" />
            <div className="drawer-foot">
              <div className="drawer-user">
                <span className="avatar" aria-hidden="true">{initials}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{user.nombre}</div>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>Doc. {user.documento}</div>
                </div>
              </div>
              <button type="button" className="menu-item danger" onClick={onLogout}>
                <LogOut size={16} aria-hidden="true" />
                Salir
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
