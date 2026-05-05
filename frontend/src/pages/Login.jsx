import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { loginWithPin, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await loginWithPin(pin);
      navigate('/', { replace: true });
    } catch (err) {
      setError('PIN non valido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a, #1e293b)'
    }}>
      <div style={{
        width: 360,
        background: '#1e293b',
        borderRadius: 16,
        padding: 40,
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
      }}>

        <h2 style={{ color: '#fff', textAlign: 'center' }}>Accesso rapido</h2>
        <p style={{ color: '#94a3b8', textAlign: 'center' }}>Inserisci il PIN</p>

        {error && <div style={{ color: '#f87171', marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0,6))}
            placeholder="••••••"
            style={{
              width: '100%',
              padding: 16,
              fontSize: 24,
              textAlign: 'center',
              borderRadius: 8,
              background: '#0f172a',
              color: '#fff',
              border: '1px solid #334155',
              letterSpacing: 8
            }}
          />

          <button
            type="submit"
            disabled={loading || pin.length !== 6}
            style={{
              width: '100%',
              marginTop: 20,
              padding: 14,
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 16,
              cursor: 'pointer'
            }}
          >
            {loading ? 'Accesso...' : 'Entra'}
          </button>
        </form>

      </div>
    </div>
  );
}
