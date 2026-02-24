import React, { useState } from 'react';
import { STYLES_NEW, COLORS_NEW } from '../lib/designSystem';

export const StatCard = ({ value, label, color = 'blue', icon: Icon, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const colorConfig = COLORS_NEW[`stat${color.charAt(0).toUpperCase() + color.slice(1)}`] || COLORS_NEW.statBlue;
  
  return (
    <div
      style={{
        ...STYLES_NEW.statCard,
        ...(isHovered ? STYLES_NEW.statCardHover : {})
      }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        style={{
          ...STYLES_NEW.statCardIcon,
          background: colorConfig.bg
        }}
      >
        {Icon && <Icon size={28} style={{ color: colorConfig.icon }} />}
      </div>
      <div style={{ ...STYLES_NEW.statCardValue, color: colorConfig.text }}>
        {value}
      </div>
      <div style={{ ...STYLES_NEW.statCardLabel, color: colorConfig.text }}>
        {label}
      </div>
    </div>
  );
};

export const StatsGrid = ({ stats }) => {
  return (
    <div style={STYLES_NEW.statsGrid}>
      {stats.map((stat, idx) => (
        <StatCard key={idx} {...stat} />
      ))}
    </div>
  );
};

export default StatCard;
