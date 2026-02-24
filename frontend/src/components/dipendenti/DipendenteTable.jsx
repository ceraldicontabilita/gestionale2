import React from 'react';

/**
 * Tabella dipendenti con azioni
 */
export function DipendenteTable({ dipendenti, loading, onView, onDelete }) {
  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40 }}>Caricamento...</div>;
  }

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={{ 
        width: '100%', 
        borderCollapse: 'collapse', 
        minWidth: 700, 
        background: 'white', 
        borderRadius: 8, 
        overflow: 'hidden', 
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)' 
      }}>
        <thead>
          <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
            <th style={{ padding: 12, textAlign: 'left' }}>Nome</th>
            <th style={{ padding: 12, textAlign: 'left' }}>Codice Fiscale</th>
            <th style={{ padding: 12, textAlign: 'left' }}>Mansione</th>
            <th style={{ padding: 12, textAlign: 'left' }}>Contatti</th>
            <th style={{ padding: 12, textAlign: 'center' }}>Azioni</th>
          </tr>
        </thead>
        <tbody>
          {dipendenti.map((dip, idx) => (
            <DipendenteRow 
              key={dip.id || idx} 
              dipendente={dip} 
              onView={onView} 
              onDelete={onDelete} 
            />
          ))}
        </tbody>
      </table>
      
      {dipendenti.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#666', background: 'white' }}>
          Nessun dipendente trovato
        </div>
      )}
    </div>
  );
}

function DipendenteRow({ dipendente, onView, onDelete }) {
  const dip = dipendente;
  
  return (
    <tr style={{ borderBottom: '1px solid #eee' }}>
      <td style={{ padding: 12 }}>
        <strong>{dip.nome_completo || `${dip.cognome || ''} ${dip.nome || ''}`.trim() || 'N/A'}</strong>
        {dip.luogo_nascita && <div style={{ fontSize: 11, color: '#666' }}>📍 {dip.luogo_nascita}</div>}
      </td>
      <td style={{ padding: 12, fontFamily: 'monospace', fontSize: 12 }}>
        {dip.codice_fiscale || <span style={{ color: '#999' }}>-</span>}
      </td>
      <td style={{ padding: 12 }}>{dip.mansione || '-'}</td>
      <td style={{ padding: 12, fontSize: 12 }}>
        {dip.telefono && <div>📱 {dip.telefono}</div>}
        {dip.email && <div style={{ color: '#666' }}>✉️ {dip.email}</div>}
      </td>
      <td style={{ padding: 12, textAlign: 'center' }}>
        <button
          onClick={() => onView(dip)}
          style={{ 
            padding: '6px 12px', 
            marginRight: 5, 
            cursor: 'pointer', 
            background: '#2196f3', 
            color: 'white', 
            border: 'none', 
            borderRadius: 4 
          }}
          title="Dettagli e Modifica"
          data-testid={`view-employee-${dip.id}`}
        >
          ✏️ Modifica
        </button>
        <button
          onClick={() => onDelete(dip.id)}
          style={{ 
            padding: '6px 12px', 
            cursor: 'pointer', 
            background: '#f44336', 
            color: 'white', 
            border: 'none', 
            borderRadius: 4 
          }}
          title="Elimina"
        >
          🗑️
        </button>
      </td>
    </tr>
  );
}
