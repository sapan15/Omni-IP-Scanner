
export interface Packet {
  id: string;
  timestamp: string;
  protocol: 'TCP' | 'UDP' | 'ICMP' | 'HTTP' | 'DNS';
  source: string;
  destination: string;
  size: number;
  info: string;
}

export interface Device {
  id: string;
  ip: string;
  mac: string;
  hostname: string;
  vendor: string;
  os: string;
  status: 'online' | 'offline';
  lastSeen: string;
  bandwidth: {
    up: number;
    down: number;
  };
  type: 'router' | 'workstation' | 'mobile' | 'iot' | 'server' | 'unknown';
  openPorts: number[];
  owner?: string;
  room?: string;
  tags: string[];
  ttl?: number;
  services?: string[];
  isBookmarked?: boolean;
  notes?: string;
}

export type ScanStatus = 'idle' | 'pinging' | 'arp_sweep' | 'port_scan' | 'fingerprinting' | 'completed';

export interface ScanResult {
  id: string;
  subnet: string;
  duration: number;
  devicesFound: number;
  timestamp: string;
  devices: Device[];
}

export type ThemeVariant = 'neon' | 'glass' | 'industrial' | 'minimal';
export type AccentColor = 'blue' | 'emerald' | 'purple' | 'amber' | 'rose';
export type ViewMode = 'table' | 'card' | 'grid' | 'topology';

export interface AppSettings {
  theme: ThemeVariant;
  accent: AccentColor;
  autoScan: boolean;
  scanInterval: number;
  showNotifications: boolean;
  detectOS: boolean;
  portRange: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  level: 'info' | 'success' | 'warn' | 'error';
}
