/**
 * PageLayout — Layout uniforme per tutte le pagine Ceraldi ERP
 * 
 * ✅ Aggiornato: usa design/tokens.js (primary #1535a8, bg #f2f6fd)
 * 
 * USO BASE:
 * <PageLayout title="Fatture" subtitle="180 documenti">
 *   {contenuto}
 * </PageLayout>
 * 
 * CON AZIONI E TAB:
 * <PageLayout 
 *   title="Banca"
 *   actions={<><button>+ Importa</button></>}
 *   tabs={[{id:'movimenti', label:'Movimenti'}, {id:'stats', label:'Statistiche'}]}
 *   activeTab={tab}
 *   onTabChange={setTab}
 * >
 *   {contenuto}
 * </PageLayout>
 */

import React from 'react';

// ── DESIGN TOKENS (unica fonte di verità) ─────────────────
const T = {
  brand:    '#1535a8',
  brandBg:  '#eef3ff',
  ink:      '#09152a',
  ink2:     '#2d4466',
  ink3:     '#6080a0',
  ink4:     '#98b0c8',
  border:   '#dce8f4',
  bg:       '#f2f6fd',
  surface:  '#ffffff',
  font:     "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const S = {
  wrapper: {
    minHeight: '100%',
    background: T.bg,
    fontFamily: T.font,
    color: T.ink,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: '22px 26px 18px',
    borderBottom: `1.5px solid ${T.border}`,
    background: T.surface,
    gap: 12,
    flexWrap: 'wrap',
  },
  titleBlock: {},
  title: {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: '-0.6px',
    color: T.ink,
    lineHeight: 1.2,
    margin: 0,
  },
  subtitle: {
    fontSize: 12,
    color: T.ink3,
    marginTop: 3,
    fontWeight: 400,
  },
  actions: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexShrink: 0,
  },
  tabsBar: {
    display: 'flex',
    gap: 0,
    padding: '0 26px',
    borderBottom: `1.5px solid ${T.border}`,
    background: '#f7f9fd',
    overflowX: 'auto',
  },
  content: {
    padding: '22px 26px 48px',
  },
};

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
    <div
      style={{ ...S.wrapper, ...(fullHeight ? {} : { minHeight: 'auto' }) }}
      className={className}
    >
      {/* ── HEADER ── */}
      {(title || actions) && (
        <div style={S.header}>
          <div style={S.titleBlock}>
            <h1 style={S.title}>
              {icon && <span style={{ marginRight: 8 }}>{icon}</span>}
              {title}
            </h1>
            {subtitle && <p style={S.subtitle}>{subtitle}</p>}
          </div>
          {actions && <div style={S.actions}>{actions}</div>}
        </div>
      )}

      {/* ── TABS ── */}
      {tabs && tabs.length > 0 && (
        <div style={S.tabsBar}>
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                style={{
                  padding: '9px 16px',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? T.brand : T.ink3,
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  borderBottom: active ? `2px solid ${T.brand}` : '2px solid transparent',
                  fontFamily: 'inherit',
                  transition: 'color .14s, border-color .14s',
                  whiteSpace: 'nowrap',
                }}
                onClick={() => onTabChange && onTabChange(tab.id)}
                data-testid={`tab-${tab.id}`}
              >
                {tab.icon && <span style={{ marginRight: 5 }}>{tab.icon}</span>}
                {tab.label}
                {tab.badge != null && (
                  <span style={{
                    marginLeft: 6,
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: 10,
                    background: T.brand,
                    color: '#fff',
                  }}>{tab.badge}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── CONTENT ── */}
      <div style={{ ...S.content, ...(noPadding ? { padding: 0 } : {}) }}>
        {children}
      </div>
    </div>
  );
}

// ── COMPONENTI HELPER ─────────────────────────────────────

export function PageSection({ title, icon, children, actions, className = '', style = {} }) {
  return (
    <div style={{
      background: T.surface,
      borderRadius: 14,
      border: `1.5px solid ${T.border}`,
      overflow: 'hidden',
      marginBottom: 16,
      boxShadow: '0 1px 4px rgba(8,24,80,.07)',
      ...style
    }} className={className}>
      {(title || actions) && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '13px 18px',
          borderBottom: `1px solid ${T.border}`,
        }}>
          <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: T.ink, display: 'flex', alignItems: 'center', gap: 8 }}>
            {icon && <span>{icon}</span>}
            {title}
          </h3>
          {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function PageGrid({ cols = 2, gap = 16, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap }}>
      {children}
    </div>
  );
}

export function PageEmpty({ icon = '📭', message = 'Nessun dato disponibile', action }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: T.ink3 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <p style={{ margin: '0 0 16px', fontSize: 15, color: T.ink2 }}>{message}</p>
      {action}
    </div>
  );
}

export function PageLoading({ message = 'Caricamento...' }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: T.ink3 }}>
      <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
      <p style={{ margin: 0, fontSize: 14 }}>{message}</p>
    </div>
  );
}

export function PageError({ message = 'Si è verificato un errore', onRetry }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#991b1b' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
      <p style={{ margin: '0 0 16px', fontSize: 15 }}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            background: T.brand,
            color: '#fff',
            border: 'none',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 13,
          }}
        >
          🔄 Riprova
        </button>
      )}
    </div>
  );
}

// Re-esporta T per chi vuole accedere ai token senza importare tokens.js
export const TOKENS = T;
