import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Bell, Calendar, Search, ChevronDown } from 'lucide-react';
import { AnnoSelector } from '../../contexts/AnnoContext';
import NotificationBell from '../NotificationBell';

// Navigazione principale - items con sottomenu
const NAV_GROUPS = [
  { to: '/', label: 'Dashboard', icon: '⊞' },
  { 
    label: 'Fatture', 
    icon: '🧾',
    badge: true,
    children: [
      { to: '/fatture-ricevute', label: 'Ciclo Passivo' },
      { to: '/corrispettivi', label: 'Corrispettivi' },
      { to: '/archivio-fatture-ricevute', label: 'Archivio' },
    ]
  },
  { to: '/prima-nota', label: 'Prima Nota', icon: '📒' },
  { 
    label: 'Banca', 
    icon: '🏦',
    dot: true,
    children: [
      { to: '/riconciliazione', label: 'Riconciliazione' },
      { to: '/archivio-bonifici', label: 'Archivio Bonifici' },
      { to: '/gestione-assegni', label: 'Gestione Assegni' },
    ]
  },
  { 
    label: 'Fisco', 
    icon: '📋',
    children: [
      { to: '/f24', label: 'F24' },
      { to: '/iva', label: 'Liquidazione IVA' },
      { to: '/fisco', label: 'Fisco & Tributi' },
    ]
  },
  { to: '/fornitori', label: 'Fornitori', icon: '🏢' },
  { 
    label: 'HR', 
    icon: '👥',
    children: [
      { to: '/dipendenti', label: 'Dipendenti' },
      { to: '/cedolini', label: 'Cedolini' },
      { to: '/attendance', label: 'Presenze' },
    ]
  },
  { 
    label: 'Altro', 
    icon: '⋯',
    children: [
      { to: '/bilancio', label: 'Bilancio' },
      { to: '/mutui', label: 'Mutui' },
      { to: '/contabilita-hub', label: 'Contabilità' },
      { to: '/magazzino', label: 'Magazzino' },
      { to: '/cucina', label: 'Cucina' },
      { to: '/scadenze', label: 'Scadenze' },
      { to: '/todo', label: 'To-Do' },
      { to: '/import-documenti', label: 'Import Documenti' },
      { to: '/documenti', label: 'Documenti' },
      { to: '/strumenti', label: 'Strumenti' },
      { to: '/integrazioni', label: 'Integrazioni' },
      { to: '/admin', label: 'Admin' },
    ]
  },
];

export default function TopNav() {
  const location = useLocation();
  const [openDropdown, setOpenDropdown] = React.useState(null);
  
  const isActive = (item) => {
    if (item.to) {
      return location.pathname === item.to || 
        (item.to !== '/' && location.pathname.startsWith(item.to));
    }
    if (item.children) {
      return item.children.some(child => 
        location.pathname === child.to || location.pathname.startsWith(child.to)
      );
    }
    return false;
  };

  return (
    <nav className="topnav-primary" data-testid="topnav-primary">
      {/* Brand */}
      <div className="topnav-brand">
        <div className="brand-square">CG</div>
        <span className="brand-name">Ceraldi ERP</span>
      </div>

      {/* Navigation Items */}
      <div className="topnav-items">
        {NAV_GROUPS.map((item, idx) => (
          item.children ? (
            <div 
              key={idx}
              className={`topnav-dropdown ${isActive(item) ? 'active' : ''}`}
              onMouseEnter={() => setOpenDropdown(idx)}
              onMouseLeave={() => setOpenDropdown(null)}
            >
              <button className={`topnav-item ${isActive(item) ? 'active' : ''}`}>
                <span className="topnav-icon">{item.icon}</span>
                <span className="topnav-label">{item.label}</span>
                {item.badge && <span className="topnav-badge">180</span>}
                {item.dot && <span className="topnav-dot" />}
                <ChevronDown size={12} className="topnav-arrow" />
              </button>
              {openDropdown === idx && (
                <div className="topnav-dropdown-menu">
                  {item.children.map((child, cidx) => (
                    <NavLink 
                      key={cidx}
                      to={child.to}
                      className={({ isActive }) => `topnav-dropdown-item ${isActive ? 'active' : ''}`}
                      onClick={() => setOpenDropdown(null)}
                    >
                      {child.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <NavLink
              key={idx}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `topnav-item ${isActive ? 'active' : ''}`}
            >
              <span className="topnav-icon">{item.icon}</span>
              <span className="topnav-label">{item.label}</span>
            </NavLink>
          )
        ))}
      </div>

      {/* Right Side - Utilities */}
      <div className="topnav-right">
        <div className="topnav-anno">
          <AnnoSelector style={{ 
            background: 'white',
            border: '1.5px solid #b3d2f5',
            borderRadius: 7,
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 600,
            color: '#1a40b5',
            minHeight: 32,
          }} />
        </div>
        
        <NotificationBell />
        
        <button className="topnav-icon-btn" title="Calendario">
          <Calendar size={15} />
        </button>
        
        <div className="topnav-user">
          <div className="topnav-avatar">CG</div>
          <div className="topnav-user-info">
            <div className="topnav-user-name">Ceraldi</div>
            <div className="topnav-user-role">Admin</div>
          </div>
        </div>
      </div>
    </nav>
  );
}
