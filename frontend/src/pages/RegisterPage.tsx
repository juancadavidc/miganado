import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, CreditCard, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import { BrandMark } from '../components/BrandMark';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [documento, setDocumento] = useState('');
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(documento.trim(), nombre.trim(), password);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="auth-box card">
        <div className="auth-brand">
          <span className="auth-brand-icon"><BrandMark size={24} /></span>
        </div>
        <h1>Crear cuenta</h1>
        <p className="muted" style={{ marginBottom: '1.25rem' }}>
          Registra tus lotes y entregas a la feria
        </p>
        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="nombre">Nombre completo</label>
            <div className="input-prefix">
              <User size={16} aria-hidden="true" />
              <input
                id="nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                autoComplete="name"
                required
                autoFocus
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="documento">Documento de identidad</label>
            <div className="input-prefix">
              <CreditCard size={16} aria-hidden="true" />
              <input
                id="documento"
                type="text"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                autoComplete="username"
                required
                inputMode="numeric"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <div className="input-prefix">
              <Lock size={16} aria-hidden="true" />
              <input
                id="password"
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
              <button
                type="button"
                className="suffix-btn"
                onClick={() => setShowPwd((s) => !s)}
                aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                tabIndex={-1}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="helper">Mínimo 6 caracteres</div>
          </div>
          {error && (
            <div className="error" role="alert">
              <AlertCircle size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
              {error}
            </div>
          )}
          <button type="submit" disabled={loading} className="btn-block" style={{ marginTop: '0.5rem' }}>
            {loading ? 'Creando…' : 'Crear cuenta'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: '1.25rem', textAlign: 'center' }}>
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}
