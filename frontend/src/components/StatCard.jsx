import React from 'react';
import { COLORS } from '../lib/utils';

/**
 * Componente StatCard condiviso per visualizzare statistiche
 * @param {string} icon - Emoji o icona da mostrare
 * @param {string} label - Etichetta della statistica
 * @param {string|number} value - Valore da mostrare
 * @param {string} color - Colore del valore (default: #1f2937)
 * @param {string} bgColor - Colore di sfondo (default: #f8fafc)
 * @param {boolean} highlight - Se true, aggiunge bordo colorato
 * @param {string} subtitle - Sottotitolo opzionale
 * @param {function} onClick - Handler click opzionale
 */
export function StatCard({ 
  icon, 
  label, 
  value, 
  color = '#1f2937', 
  bgColor = '#f8fafc', 
  highlight = false,
  subtitle,
  onClick
}) {
  return (
    <div 
      onClick={onClick}
      style={{
        background: bgColor,
        borderRadius: 12,
        padding: 16,
        border: highlight ? `2px solid ${color}` : '1px solid #e5e7eb',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && <span style={{ fontSize: 20 }}>{icon}</span>}
        <span style={{ color: '#6b7280', fontSize: 12, fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ 
        fontSize: 24, 
        fontWeight: 700, 
        color: color, 
        marginTop: 4 
      }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

/**
 * Variante compatta di StatCard
 */
export function StatCardCompact({ icon, label, value, color = '#1f2937' }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      background: '#f8fafc',
      borderRadius: 8,
      border: '1px solid #e5e7eb'
    }}>
      {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
      <div>
        <div style={{ fontSize: 11, color: '#6b7280' }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 600, color }}>{value}</div>
      </div>
    </div>
  );
}

/**
 * Griglia di StatCard
 */
export function StatGrid({ children, columns = 4 }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(${Math.floor(100/columns)}%, 1fr))`,
      gap: 16
    }}>
      {children}
    </div>
  );
}

export default StatCard;
