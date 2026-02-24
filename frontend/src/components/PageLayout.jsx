/**
 * PageLayout - Componente wrapper per layout uniforme delle pagine
 * 
 * USO:
 * <PageLayout title="Titolo Pagina" subtitle="Descrizione opzionale">
 *   {contenuto della pagina}
 * </PageLayout>
 * 
 * oppure con azioni nell'header:
 * <PageLayout 
 *   title="Titolo" 
 *   actions={<button>Azione</button>}
 *   tabs={[{id: 'tab1', label: 'Tab 1'}, {id: 'tab2', label: 'Tab 2'}]}
 *   activeTab="tab1"
 *   onTabChange={(tabId) => ...}
 * >
 *   {contenuto}
 * </PageLayout>
 */

import React from 'react';
import {
  PAGE_WRAPPER,
  PAGE_CONTAINER,
  PAGE_HEADER,
  PAGE_CONTENT,
  PAGE_TITLE,
  PAGE_SUBTITLE,
  HEADER_ACTIONS,
  TABS_CONTAINER,
  TAB_STYLE,
} from '../design/pageLayoutStyle';

export function PageLayout({ 
  title,
  subtitle,
  icon,
  children, 
  actions, 
  tabs, 
  activeTab, 
  onTabChange,
  noPadding = false,
  fullHeight = true,
  className = '',
}) {
  return (
    <div style={{
      ...PAGE_WRAPPER,
      ...(fullHeight ? {} : { minHeight: 'auto' })
    }} className={className}>
      <div style={PAGE_CONTAINER}>
        {/* Header con titolo e azioni */}
        {(title || actions) && (
          <div style={PAGE_HEADER}>
            <div>
              <h1 style={PAGE_TITLE}>
                {icon && <span style={{ marginRight: 8 }}>{icon}</span>}
                {title}
              </h1>
              {subtitle && <p style={PAGE_SUBTITLE}>{subtitle}</p>}
            </div>
            {actions && <div style={HEADER_ACTIONS}>{actions}</div>}
          </div>
        )}
        
        {/* Tabs opzionali */}
        {tabs && tabs.length > 0 && (
          <div style={{ ...TABS_CONTAINER, padding: '0 24px' }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                style={TAB_STYLE(activeTab === tab.id)}
                onClick={() => onTabChange && onTabChange(tab.id)}
                data-testid={`tab-${tab.id}`}
              >
                {tab.icon && <span style={{ marginRight: 6 }}>{tab.icon}</span>}
                {tab.label}
              </button>
            ))}
          </div>
        )}
        
        {/* Contenuto principale */}
        <div style={{
          ...PAGE_CONTENT,
          ...(noPadding ? { padding: 0 } : {})
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// Componenti helper per composizione
export function PageSection({ title, icon, children, className = '', style = {} }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: '1px solid #e2e8f0',
      padding: 20,
      marginBottom: 16,
      ...style
    }} className={className}>
      {title && (
        <h3 style={{ 
          margin: '0 0 16px 0', 
          fontSize: 16, 
          fontWeight: 600, 
          color: '#1e3a5f',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          {icon && <span>{icon}</span>}
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

export function PageGrid({ cols = 2, gap = 20, children }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap
    }}>
      {children}
    </div>
  );
}

export function PageEmpty({ icon = '📭', message = 'Nessun dato disponibile' }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '60px 20px',
      color: '#64748b'
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <p style={{ margin: 0, fontSize: 15 }}>{message}</p>
    </div>
  );
}

export function PageLoading({ message = 'Caricamento...' }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '60px 20px',
      color: '#64748b'
    }}>
      <div style={{ fontSize: 32, marginBottom: 16, animation: 'spin 1s linear infinite' }}>⏳</div>
      <p style={{ margin: 0, fontSize: 14 }}>{message}</p>
    </div>
  );
}

export function PageError({ message = 'Si è verificato un errore', onRetry }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '40px 20px',
      background: '#fef2f2',
      borderRadius: 12,
      border: '1px solid #fca5a5',
      color: '#dc2626'
    }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
      <p style={{ margin: '0 0 16px 0', fontSize: 14 }}>{message}</p>
      {onRetry && (
        <button 
          onClick={onRetry}
          style={{
            padding: '8px 16px',
            background: '#dc2626',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500
          }}
        >
          Riprova
        </button>
      )}
    </div>
  );
}

export default PageLayout;
