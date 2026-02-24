import React from 'react';
import { MANSIONI } from './constants';

/**
 * Modale per creare un nuovo dipendente
 */
export function DipendenteNewModal({ show, newDipendente, setNewDipendente, onClose, onCreate }) {
  if (!show) return null;

  const inputStyle = { padding: 8, width: '100%', borderRadius: 4, border: '1px solid #ddd' };
  const labelStyle = { display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: 12 };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
    }} onClick={onClose}>
      <div style={{
        background: 'white', borderRadius: 12, padding: 24, maxWidth: 600, width: '100%',
        maxHeight: '90vh', overflow: 'auto'
      }} onClick={e => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>➕ Nuovo Dipendente</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 15 }}>
          <div>
            <label style={labelStyle}>Nome *</label>
            <input
              type="text"
              value={newDipendente.nome}
              onChange={(e) => setNewDipendente({ ...newDipendente, nome: e.target.value })}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Cognome *</label>
            <input
              type="text"
              value={newDipendente.cognome}
              onChange={(e) => setNewDipendente({ ...newDipendente, cognome: e.target.value })}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Codice Fiscale</label>
            <input
              type="text"
              value={newDipendente.codice_fiscale}
              onChange={(e) => setNewDipendente({ ...newDipendente, codice_fiscale: e.target.value.toUpperCase() })}
              style={{ ...inputStyle, fontFamily: 'monospace' }}
            />
          </div>
          <div>
            <label style={labelStyle}>Mansione</label>
            <select
              value={newDipendente.mansione}
              onChange={(e) => setNewDipendente({ ...newDipendente, mansione: e.target.value })}
              style={inputStyle}
            >
              <option value="">Seleziona...</option>
              {MANSIONI.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Telefono</label>
            <input
              type="tel"
              value={newDipendente.telefono}
              onChange={(e) => setNewDipendente({ ...newDipendente, telefono: e.target.value })}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={newDipendente.email}
              onChange={(e) => setNewDipendente({ ...newDipendente, email: e.target.value })}
              style={inputStyle}
            />
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '10px 20px', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Annulla
          </button>
          <button
            onClick={onCreate}
            style={{ padding: '10px 20px', background: '#4caf50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            ➕ Crea Dipendente
          </button>
        </div>
      </div>
    </div>
  );
}
