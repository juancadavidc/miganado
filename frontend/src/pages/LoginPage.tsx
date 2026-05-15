import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreditCard, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import { BrandMark } from '../components/BrandMark';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [documento, setDocumento] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(documento.trim(), password);
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
        <h1>Bienvenido a miganado</h1>
        <p className="muted" style={{ marginBottom: '1.25rem' }}>
          Ingresa con tu documento de identidad
        </p>
        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="documento">Documento</label>
            <div className="input-prefix">
              <CreditCard size={16} aria-hidden="true" />
              <input
                id="documento"
                type="text"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                inputMode="numeric"
                placeholder="Ej. 1234567890"
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
                autoComplete="current-password"
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
          </div>
          {error && (
            <div className="error" role="alert">
              <AlertCircle size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
              {error}
            </div>
          )}
          <button type="submit" disabled={loading} className="btn-block" style={{ marginTop: '0.5rem' }}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: '1.25rem', textAlign: 'center' }}>
          ¿No tienes cuenta? <Link to="/registro">Regístrate</Link>
        </p>
      </div>
    </div>
  );
}
