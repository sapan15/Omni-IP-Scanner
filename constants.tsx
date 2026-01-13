
import React from 'react';

export const THEME_COLORS = {
  primary: '#3b82f6',
  secondary: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  bg: '#020617',
};

export const DEVICE_ICONS: Record<string, React.ReactNode> = {
  router: <i className="fas fa-network-wired text-blue-400"></i>,
  workstation: <i className="fas fa-desktop text-emerald-400"></i>,
  mobile: <i className="fas fa-mobile-alt text-purple-400"></i>,
  iot: <i className="fas fa-microchip text-amber-400"></i>,
  server: <i className="fas fa-server text-red-400"></i>,
  unknown: <i className="fas fa-question-circle text-slate-400"></i>,
};
