import React, { useState, lazy, Suspense } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

const SectionLoading = () => (
  <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
    <div style={{
      width: 32, height: 32,
      border: '3px solid #e2e8f0',
      borderTop: '3px solid #2563eb',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
      margin: '0 auto 12px'
    }} />
    Caricamento sezione...
  </div>
);

export function SectionPage({ title, subtitle, icon, sections, defaultOpen, actions }) {
  const [openSections, setOpenSections] = useState(() => {
    if (defaultOpen) return { [defaultOpen]: true };
    if (sections.length > 0) return { [sections[0].id]: true };
    return {};
  });

  const toggle = (id) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div data-testid="section-page" style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #e2e8f0',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16
      }}>
        <div>
          <h1 data-testid="section-page-title" style={{
            fontSize: 22,
            fontWeight: 700,
            color: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            margin: 0
          }}>
            {icon && <span style={{ color: '#3b82f6' }}>{icon}</span>}
            {title}
          </h1>
          {subtitle && (
            <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>{subtitle}</p>
          )}
        </div>
        {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
      </div>

      {/* Section Navigation - Quick Jump */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #e2e8f0',
        padding: '8px 24px',
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        overflowX: 'auto'
      }}>
        {sections.map(s => (
          <button
            key={s.id}
            data-testid={`section-nav-${s.id}`}
            onClick={() => {
              setOpenSections(prev => ({ ...prev, [s.id]: true }));
              document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              border: '1px solid #e2e8f0',
              borderRadius: 20,
              background: openSections[s.id] ? '#1e293b' : '#f1f5f9',
              color: openSections[s.id] ? 'white' : '#475569',
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            {s.icon && <span style={{ opacity: 0.8 }}>{s.icon}</span>}
            {s.label}
          </button>
        ))}
      </div>

      {/* Sections */}
      <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sections.map(s => (
          <div
            key={s.id}
            id={`section-${s.id}`}
            data-testid={`section-${s.id}`}
            style={{
              background: 'white',
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              transition: 'box-shadow 0.2s',
              boxShadow: openSections[s.id] ? '0 2px 12px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            {/* Section Header - Clickable */}
            <button
              data-testid={`section-toggle-${s.id}`}
              onClick={() => toggle(s.id)}
              style={{
                width: '100%',
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: openSections[s.id] ? '#f8fafc' : 'white',
                border: 'none',
                borderBottom: openSections[s.id] ? '1px solid #e2e8f0' : 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.2s'
              }}
            >
              {openSections[s.id]
                ? <ChevronDown size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
                : <ChevronRight size={18} style={{ color: '#94a3b8', flexShrink: 0 }} />
              }
              {s.icon && <span style={{ fontSize: 18, flexShrink: 0 }}>{s.icon}</span>}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{s.label}</div>
                {s.desc && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{s.desc}</div>}
              </div>
              {s.badge && (
                <span style={{
                  padding: '2px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  background: '#dbeafe',
                  color: '#2563eb',
                  borderRadius: 12
                }}>{s.badge}</span>
              )}
            </button>

            {/* Section Content */}
            {openSections[s.id] && (
              <Suspense fallback={<SectionLoading />}>
                <div style={{ minHeight: 200 }}>
                  {s.component}
                </div>
              </Suspense>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
