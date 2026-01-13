
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { Device, ScanStatus, ThemeVariant, AccentColor, AppSettings, ScanResult, Packet, ViewMode, LogEntry } from './types';
import { DEVICE_ICONS } from './constants';
import { fingerprintDevice, simulateDeepProbe, generateNetworkAudit } from './services/geminiService';

const App: React.FC = () => {
  // --- Core State ---
  const [devices, setDevices] = useState<Device[]>([]);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [activeTab, setActiveTab] = useState<'scanner' | 'history' | 'settings'>('scanner');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [notifications, setNotifications] = useState<{id: string, msg: string, type: 'info' | 'warn'}[]>([]);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [auditText, setAuditText] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // --- Terminal State ---
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [terminalInput, setTerminalInput] = useState('');

  const [settings, setSettings] = useState<AppSettings>({
    theme: 'glass',
    accent: 'blue',
    autoScan: false,
    scanInterval: 5,
    showNotifications: true,
    detectOS: true,
    portRange: '1-1024'
  });

  const packetInterval = useRef<number | null>(null);
  const autoScanTimer = useRef<number | null>(null);

  // --- Initial Data ---
  useEffect(() => {
    const saved = localStorage.getItem('omniscan_v4_data');
    if (saved) {
      const { history, devices, settings: savedSettings } = JSON.parse(saved);
      if (history) setHistory(history);
      if (devices) setDevices(devices);
      if (savedSettings) setSettings(savedSettings);
    } else {
      setDevices([
        { id: '1', ip: '192.168.1.1', mac: '00:1A:2B:3C:4D:5E', hostname: 'Gateway-Router', vendor: 'Ubiquiti', os: 'EdgeOS v2.0', status: 'online', lastSeen: new Date().toISOString(), bandwidth: { up: 2.1, down: 88.4 }, type: 'router', openPorts: [80, 443, 8080], tags: ['Static', 'Infrastructure'], isBookmarked: true },
        { id: '2', ip: '192.168.1.12', mac: 'F0:18:98:33:22:11', hostname: 'Alex-Workstation', vendor: 'Apple', os: 'macOS Sonoma', status: 'online', lastSeen: new Date().toISOString(), bandwidth: { up: 12.4, down: 45.2 }, type: 'workstation', openPorts: [22, 5173], tags: ['Work'] }
      ]);
    }
  }, []);

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem('omniscan_v4_data', JSON.stringify({ history, devices, settings }));
  }, [history, devices, settings]);

  // --- Auto-Scan Engine ---
  useEffect(() => {
    if (settings.autoScan) {
      autoScanTimer.current = window.setInterval(() => {
        if (scanStatus === 'idle') {
          addLog('Performing background maintenance scan...', 'info');
          handleStartScan();
        }
      }, settings.scanInterval * 60 * 1000);
    } else {
      if (autoScanTimer.current) clearInterval(autoScanTimer.current);
    }
    return () => { if (autoScanTimer.current) clearInterval(autoScanTimer.current); };
  }, [settings.autoScan, settings.scanInterval, scanStatus]);

  // --- Utilities ---
  const addLog = (message: string, level: LogEntry['level'] = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setLogs(prev => [{ id, timestamp: new Date().toLocaleTimeString(), message, level }, ...prev].slice(0, 50));
  };

  const addNotification = (msg: string, type: 'info' | 'warn' = 'info') => {
    if (!settings.showNotifications) return;
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000);
  };

  const handleStartScan = useCallback(async () => {
    setScanStatus('pinging');
    setScanProgress(0);
    addLog('Subnet sweep initiated. Targeting 192.168.1.0/24', 'info');
    
    const startTime = Date.now();
    const phases: ScanStatus[] = ['pinging', 'arp_sweep', 'port_scan', 'fingerprinting'];
    
    for (const phase of phases) {
      setScanStatus(phase);
      for (let i = 0; i < 25; i++) {
        setScanProgress(prev => prev + 1);
        await new Promise(r => setTimeout(r, 40));
      }
    }

    const newDevice: Device = {
      id: Math.random().toString(),
      ip: `192.168.1.${Math.floor(Math.random() * 254)}`,
      mac: 'E0:F8:47:11:22:33',
      hostname: 'New-Device-Identified',
      vendor: 'Samsung',
      os: 'Tizen OS',
      status: 'online',
      lastSeen: new Date().toISOString(),
      bandwidth: { up: 0.1, down: 0.4 },
      type: 'iot',
      openPorts: [8000],
      tags: ['New']
    };

    setDevices(prev => {
      const exists = prev.some(d => d.ip === newDevice.ip);
      if (exists) return prev;
      addNotification(`Intrusion Alert: New device at ${newDevice.ip}`, 'warn');
      return [...prev, newDevice];
    });

    setScanStatus('completed');
    addLog(`Network map updated in ${(Date.now() - startTime) / 1000}s`, 'success');
    setTimeout(() => setScanStatus('idle'), 2000);
  }, [devices]);

  const handleDeepProbe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim() || !selectedDevice) return;
    const cmd = terminalInput;
    setTerminalLogs(prev => [...prev, `root@omniscan:~# ${cmd}`]);
    setTerminalInput('');
    const output = await simulateDeepProbe(selectedDevice.hostname, selectedDevice.ip, cmd);
    setTerminalLogs(prev => [...prev, output]);
  };

  const toggleBookmark = (id: string) => {
    setDevices(prev => prev.map(d => d.id === id ? { ...d, isBookmarked: !d.isBookmarked } : d));
  };

  const filteredDevices = useMemo(() => {
    return devices.filter(d => 
      d.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.ip.includes(searchTerm) ||
      d.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [devices, searchTerm]);

  const themeClasses = {
    glass: 'glass border-white/10',
    neon: 'bg-black border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]',
    industrial: 'bg-slate-900 border-slate-700 rounded-none shadow-[4px_4px_0_0_#000]',
    minimal: 'bg-white text-black border-slate-200'
  };

  return (
    <div className={`flex h-screen w-full bg-slate-950 text-slate-100 selection:bg-${settings.accent}-500 overflow-hidden font-['Inter']`}>
      {/* Toast Notifications */}
      <div className="fixed top-8 right-8 z-[100] flex flex-col gap-3 pointer-events-none">
        {notifications.map(n => (
          <div key={n.id} className="bg-slate-900/95 backdrop-blur-2xl border border-slate-700/50 p-5 rounded-2xl shadow-2xl flex items-center space-x-4 animate-in slide-in-from-right duration-300 pointer-events-auto">
            <div className={`w-3 h-3 rounded-full ${n.type === 'warn' ? 'bg-rose-500 shadow-[0_0_10px_#f43f5e]' : 'bg-blue-500 shadow-[0_0_10px_#3b82f6]'}`}></div>
            <span className="text-sm font-bold">{n.msg}</span>
          </div>
        ))}
      </div>

      {/* Responsive Navigation Sidebar */}
      <nav className={`${isSidebarOpen ? 'w-72' : 'w-24'} bg-slate-900 border-r border-slate-800 transition-all duration-500 flex flex-col p-6 z-50 hidden md:flex`}>
        <div className="flex items-center space-x-4 mb-12">
          <div 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`w-14 h-14 shrink-0 rounded-3xl bg-${settings.accent}-600 flex items-center justify-center shadow-2xl rotate-3 hover:rotate-0 transition-all cursor-pointer overflow-hidden group`}
          >
            <i className="fas fa-radar text-2xl text-white group-hover:scale-125 transition-transform"></i>
          </div>
          {isSidebarOpen && (
            <div className="animate-in fade-in slide-in-from-left duration-500">
              <h1 className="text-xl font-black tracking-tighter uppercase italic leading-none">OmniScan</h1>
              <span className="text-[10px] text-slate-500 font-black tracking-[0.3em] uppercase">Intelligence</span>
            </div>
          )}
        </div>

        <div className="flex-1 space-y-3">
          <NavItem active={activeTab === 'scanner'} onClick={() => setActiveTab('scanner')} icon="fa-network-wired" label="Subnet Scan" open={isSidebarOpen} accent={settings.accent} />
          <NavItem active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon="fa-database" label="Archive" open={isSidebarOpen} accent={settings.accent} />
          <NavItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon="fa-sliders" label="Config" open={isSidebarOpen} accent={settings.accent} />
        </div>

        {isSidebarOpen && (
          <div className="mt-auto space-y-6 animate-in fade-in slide-in-from-bottom duration-500">
            <div className="bg-slate-950 border border-slate-800 rounded-[2rem] p-6">
              <div className="text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Network Load</div>
              <div className="text-3xl font-black mb-1">112.4 <span className="text-xs text-slate-600">Mb/s</span></div>
              <div className="h-1.5 bg-slate-900 rounded-full mt-4 overflow-hidden">
                <div className={`h-full bg-${settings.accent}-500 w-2/3 shadow-[0_0_10px_#3b82f6] animate-pulse`}></div>
              </div>
            </div>
            <button 
              onClick={async () => {
                setIsAuditOpen(true);
                setAuditText('');
                const res = await generateNetworkAudit(devices);
                setAuditText(res);
              }}
              className={`w-full h-14 bg-${settings.accent}-600/10 border border-${settings.accent}-500/30 text-${settings.accent}-400 rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-widest hover:bg-${settings.accent}-600 hover:text-white transition-all`}
            >
              <i className="fas fa-brain"></i> AI Health Audit
            </button>
          </div>
        )}
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative bg-slate-950">
        <header className="h-24 px-10 border-b border-slate-800 flex items-center justify-between backdrop-blur-3xl z-40 bg-slate-950/80">
          <div className="flex items-center gap-8 flex-1 max-w-2xl">
            <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-2xl shadow-inner">
               <ViewBtn active={viewMode === 'card'} onClick={() => setViewMode('card')} icon="fa-grip-vertical" />
               <ViewBtn active={viewMode === 'topology'} onClick={() => setViewMode('topology')} icon="fa-circle-nodes" />
               <ViewBtn active={viewMode === 'table'} onClick={() => setViewMode('table')} icon="fa-table-list" />
            </div>
            <div className="relative flex-1 group">
               <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-400 transition-colors"></i>
               <input 
                type="text" 
                placeholder="Search nodes, MACs, or vendors..." 
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-4 pl-14 pr-4 text-xs font-bold focus:outline-none focus:border-blue-500/50 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
               />
            </div>
          </div>

          <div className="flex items-center gap-6 ml-6">
            <button 
              onClick={handleStartScan}
              disabled={scanStatus !== 'idle'}
              className={`push-button-3d h-14 px-10 rounded-2xl font-black text-xs tracking-widest flex items-center gap-4 transition-all ${
                scanStatus === 'idle' ? `bg-${settings.accent}-600 hover:bg-${settings.accent}-500 text-white shadow-[0_6px_0_0_#1e293b]` : 'bg-slate-800 text-slate-500 opacity-60 cursor-not-allowed'
              }`}
            >
              {scanStatus === 'idle' ? <><i className="fas fa-bolt-lightning text-xs"></i> DISCOVERY</> : <><i className="fas fa-circle-notch fa-spin"></i> {scanStatus.toUpperCase()}</>}
            </button>
          </div>
        </header>

        {/* Content Region */}
        <div className="flex-1 overflow-y-auto p-12 relative custom-scrollbar">
          {scanStatus !== 'idle' && (
            <div className="fixed top-24 left-0 right-0 h-1 z-50 pointer-events-none">
              <div className={`h-full bg-${settings.accent}-500 shadow-[0_0_15px_#3b82f6] transition-all duration-300`} style={{ width: `${scanProgress}%` }}></div>
            </div>
          )}

          {activeTab === 'scanner' && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
               {viewMode === 'topology' ? (
                 <TopologyMap devices={filteredDevices} accent={settings.accent} onSelect={setSelectedDevice} selectedId={selectedDevice?.id} />
               ) : (
                 <div className={viewMode === 'card' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8' : 'w-full'}>
                   {filteredDevices.map(device => (
                     <DeviceNode 
                        key={device.id} 
                        device={device} 
                        view={viewMode}
                        accent={settings.accent}
                        active={selectedDevice?.id === device.id}
                        onClick={() => setSelectedDevice(device)}
                        onBookmark={() => toggleBookmark(device.id)}
                     />
                   ))}
                 </div>
               )}
            </div>
          )}

          {activeTab === 'history' && <HistoryTab history={history} accent={settings.accent} onRestore={setDevices} />}
          {activeTab === 'settings' && <SettingsTab settings={settings} onUpdate={setSettings} />}
        </div>

        {/* Real-Time Log Dock */}
        <div className="h-12 bg-slate-900 border-t border-slate-800 flex items-center px-8 gap-6 z-[60] shrink-0">
           <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
             <i className="fas fa-terminal"></i> Terminal Log
           </div>
           <div className="flex-1 overflow-hidden">
              <div className="flex gap-4 animate-in slide-in-from-bottom-2 duration-300">
                <span className={`text-[10px] mono text-${settings.accent}-400`}>[{logs[0]?.timestamp || '--:--:--'}]</span>
                <span className="text-[10px] mono text-slate-400 truncate">{logs[0]?.message || 'Idle... waiting for input.'}</span>
              </div>
           </div>
           <div className="flex items-center gap-3">
             <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
             <span className="text-[9px] font-black text-emerald-400 uppercase">Engine Ready</span>
           </div>
        </div>

        {/* Device Intelligence Drawer */}
        {selectedDevice && (
          <aside className="w-[520px] border-l border-slate-800 bg-slate-950/95 backdrop-blur-3xl absolute right-0 top-0 bottom-0 z-[100] animate-in slide-in-from-right duration-500 shadow-[-30px_0_100px_rgba(0,0,0,0.8)] flex flex-col">
             <div className="p-10 border-b border-slate-800 flex items-center justify-between">
               <div>
                 <h3 className="text-2xl font-black italic tracking-tighter uppercase">Node Intel</h3>
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Live Telemetry Session</p>
               </div>
               <div className="flex gap-2">
                 <button 
                  onClick={() => setIsTerminalOpen(true)}
                  className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-400 hover:text-white transition-all"
                  title="Deep Probe Terminal"
                 >
                   <i className="fas fa-terminal"></i>
                 </button>
                 <button onClick={() => setSelectedDevice(null)} className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 hover:text-white transition-all">
                   <i className="fas fa-xmark text-xl"></i>
                 </button>
               </div>
             </div>

             <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar">
                <div className="flex items-center gap-10">
                   <div className={`w-28 h-28 rounded-[2.5rem] bg-slate-900 border-4 border-slate-800 flex items-center justify-center text-5xl text-${settings.accent}-500 shadow-inner group hover:scale-105 transition-transform`}>
                     {DEVICE_ICONS[selectedDevice.type]}
                   </div>
                   <div>
                     <h4 className="text-3xl font-black mb-2 flex items-center gap-4">
                       {selectedDevice.hostname}
                       {selectedDevice.isBookmarked && <i className="fas fa-bookmark text-amber-500 text-xs"></i>}
                     </h4>
                     <div className="flex flex-wrap gap-2">
                       {selectedDevice.tags.map(t => (
                         <span key={t} className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-[9px] font-black text-slate-500 uppercase tracking-widest">{t}</span>
                       ))}
                     </div>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                   <DataField label="IPV4 Target" value={selectedDevice.ip} mono color={settings.accent} />
                   <DataField label="Hardware MAC" value={selectedDevice.mac} mono />
                   <DataField label="Vendor Label" value={selectedDevice.vendor} />
                   <DataField label="Kernel / OS" value={selectedDevice.os} />
                   <DataField label="System TTL" value={String(selectedDevice.ttl || 64)} />
                   <DataField label="Last Contact" value={new Date(selectedDevice.lastSeen).toLocaleTimeString()} />
                </div>

                <div className="space-y-4">
                   <h5 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] italic">Traffic Load (Mb/s)</h5>
                   <div className="h-44 rounded-[2.5rem] bg-slate-900/50 border border-slate-800 p-6 overflow-hidden">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={Array.from({length: 20}).map(() => ({ v: Math.random() * 100 }))}>
                           <Area type="monotone" dataKey="v" stroke={settings.accent === 'blue' ? '#3b82f6' : '#10b981'} fill={settings.accent === 'blue' ? '#3b82f620' : '#10b98120'} strokeWidth={4} />
                        </AreaChart>
                      </ResponsiveContainer>
                   </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                   {selectedDevice.openPorts.map(p => (
                     <div key={p} className="bg-slate-900 border border-slate-800 p-4 rounded-3xl text-center group hover:border-blue-500/50 transition-all">
                        <div className="text-sm font-black text-blue-400">{p}</div>
                        <div className="text-[8px] font-black text-slate-600 uppercase mt-1">TCP</div>
                     </div>
                   ))}
                </div>
             </div>

             <div className="p-10 bg-slate-950 border-t border-slate-800">
                <button className={`w-full h-16 bg-white text-black font-black rounded-3xl flex items-center justify-center gap-4 uppercase tracking-[0.2em] shadow-[0_6px_0_0_#cbd5e1] active:translate-y-1 transition-all text-xs`} onClick={() => setIsTerminalOpen(true)}>
                  <i className="fas fa-terminal"></i> Execute Remote Probe
                </button>
             </div>
          </aside>
        )}

        {/* AI Audit Report Backdrop */}
        {isAuditOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 bg-black/90 backdrop-blur-2xl animate-in fade-in duration-500">
             <div className="max-w-5xl w-full bg-slate-900 border border-slate-800 rounded-[3rem] p-12 max-h-[90vh] overflow-y-auto relative custom-scrollbar shadow-[0_0_100px_rgba(59,130,246,0.15)]">
                <button onClick={() => setIsAuditOpen(false)} className="absolute top-10 right-10 w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center hover:bg-rose-600 transition-colors">
                   <i className="fas fa-times text-xl"></i>
                </button>
                <div className="flex items-center gap-8 mb-16">
                   <div className="w-24 h-24 rounded-[2rem] bg-blue-600 flex items-center justify-center text-5xl shadow-2xl">
                     <i className="fas fa-shield-virus"></i>
                   </div>
                   <div>
                      <h2 className="text-5xl font-black italic tracking-tighter uppercase">Infrastructure Audit</h2>
                      <p className="text-slate-500 font-bold uppercase tracking-widest mt-2">AI-Driven Risk Matrix v4.1</p>
                   </div>
                </div>
                {!auditText ? (
                  <div className="flex flex-col items-center justify-center py-32 gap-8">
                     <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                     <p className="text-slate-500 font-black italic uppercase tracking-widest animate-pulse">Scanning Data Clusters...</p>
                  </div>
                ) : (
                  <div className="prose prose-invert prose-blue max-w-none">
                     <pre className="whitespace-pre-wrap text-slate-300 font-medium leading-relaxed font-sans text-lg">{auditText}</pre>
                  </div>
                )}
             </div>
          </div>
        )}

        {/* Deep Probe Terminal Modal */}
        {isTerminalOpen && selectedDevice && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-12 bg-black/60 backdrop-blur-md animate-in zoom-in duration-300">
            <div className="w-full max-w-4xl bg-[#0c0c0c] border border-slate-800 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
              <div className="h-12 bg-slate-900 px-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                    <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Session: {selectedDevice.hostname} ({selectedDevice.ip})</span>
                </div>
                <button onClick={() => setIsTerminalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                  <i className="fas fa-times"></i>
                </button>
              </div>
              <div className="flex-1 p-8 mono text-xs overflow-y-auto max-h-[500px] custom-scrollbar space-y-2 bg-black/50">
                 <div className="text-emerald-500 mb-4">OmniScan Virtual Probe Terminal [Version 3.2.0]</div>
                 <div className="text-slate-500 mb-6">Connected to node via secure tunnel. Ready for commands.</div>
                 {terminalLogs.map((log, i) => (
                   <div key={i} className="whitespace-pre-wrap leading-relaxed">
                     {log.startsWith('root@') ? (
                        <span className="text-blue-400 font-bold">{log}</span>
                     ) : (
                        <span className="text-slate-400">{log}</span>
                     )}
                   </div>
                 ))}
              </div>
              <form onSubmit={handleDeepProbe} className="p-4 bg-slate-900 border-t border-slate-800 flex items-center gap-4">
                 <span className="text-blue-400 mono text-xs font-bold pl-2">root@omniscan:~#</span>
                 <input 
                  autoFocus
                  type="text" 
                  className="flex-1 bg-transparent mono text-xs focus:outline-none text-white" 
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  placeholder="ping -c 4 target..."
                 />
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

// --- Atomic Components ---

const NavItem = ({ active, onClick, icon, label, open, accent }: any) => (
  <button 
    onClick={onClick} 
    className={`w-full flex items-center p-5 rounded-3xl transition-all group ${
      active ? `bg-${accent}-600 text-white shadow-2xl shadow-${accent}-900/40` : 'text-slate-500 hover:bg-slate-900 hover:text-slate-100'
    }`}
  >
    <div className={`w-8 text-center text-lg ${active ? 'scale-110' : 'group-hover:scale-110'} transition-transform`}>
      <i className={`fas ${icon}`}></i>
    </div>
    {open && <span className="font-black text-[10px] uppercase tracking-[0.2em] ml-4 animate-in slide-in-from-left duration-300">{label}</span>}
    {active && open && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white"></div>}
  </button>
);

const ViewBtn = ({ active, onClick, icon }: any) => (
  <button 
    onClick={onClick} 
    className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all ${active ? 'bg-slate-800 text-white shadow-xl' : 'text-slate-500 hover:text-slate-100'}`}
  >
    <i className={`fas ${icon}`}></i>
  </button>
);

const DeviceNode = ({ device, view, accent, active, onClick, onBookmark }: any) => {
  if (view === 'table') {
    return (
      <div 
        onClick={onClick}
        className={`flex items-center justify-between p-6 mb-3 rounded-[2rem] border-2 cursor-pointer transition-all ${active ? `border-${accent}-500 bg-${accent}-600/10` : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}
      >
        <div className="flex items-center gap-6">
           <div className={`w-14 h-14 rounded-2xl bg-slate-950 flex items-center justify-center text-2xl text-${accent}-500`}>
             {DEVICE_ICONS[device.type]}
           </div>
           <div>
              <div className="font-black italic flex items-center gap-3">
                {device.hostname}
                {device.isBookmarked && <i className="fas fa-bookmark text-amber-500 text-[10px]"></i>}
              </div>
              <div className="text-[10px] mono text-slate-500 uppercase font-bold">{device.ip} • {device.vendor}</div>
           </div>
        </div>
        <div className="flex items-center gap-8">
           <div className="text-right">
              <div className="text-[9px] font-black text-slate-600 uppercase">OS Detection</div>
              <div className="text-xs font-bold text-slate-400">{device.os}</div>
           </div>
           <button onClick={(e) => { e.stopPropagation(); onBookmark(); }} className={`p-3 rounded-xl transition-colors ${device.isBookmarked ? 'text-amber-500' : 'text-slate-700 hover:text-slate-500'}`}>
              <i className="fas fa-bookmark"></i>
           </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      onClick={onClick} 
      className={`p-8 border-2 transition-all duration-500 cursor-pointer group rounded-[3rem] relative overflow-hidden ${
        active ? `border-${accent}-500 bg-slate-900 shadow-2xl scale-[1.03]` : 'bg-slate-900 border-slate-800 hover:border-slate-700'
      }`}
    >
      <div className="flex justify-between items-start mb-10">
        <div className={`w-20 h-20 rounded-[2rem] bg-slate-950 border-2 border-slate-800 flex items-center justify-center text-3xl text-${accent}-500 group-hover:rotate-12 transition-transform shadow-inner`}>
           {DEVICE_ICONS[device.type]}
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onBookmark(); }}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${device.isBookmarked ? 'bg-amber-500/10 text-amber-500' : 'text-slate-700 hover:text-slate-500'}`}
        >
          <i className="fas fa-bookmark"></i>
        </button>
      </div>
      <div className="mb-8">
        <h4 className="text-2xl font-black tracking-tighter truncate leading-none mb-2 italic uppercase">{device.hostname}</h4>
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{device.vendor} • {device.os.split(' ')[0]}</div>
      </div>
      <div className="flex items-center justify-between pt-6 border-t border-slate-800/50">
         <span className={`text-sm font-black mono text-${accent}-400 tracking-tighter`}>{device.ip}</span>
         <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span className="text-[9px] font-black text-emerald-400">UP</span>
         </div>
      </div>
    </div>
  );
};

const TopologyMap = ({ devices, accent, onSelect, selectedId }: any) => {
  const router = devices.find((d: any) => d.type === 'router') || devices[0];
  const nodes = devices.filter((d: any) => d.id !== router.id);

  return (
    <div className="h-[700px] w-full bg-slate-950/50 rounded-[5rem] border-2 border-dashed border-slate-800 relative flex items-center justify-center overflow-hidden">
       {/* Central Node */}
       <div className="z-20 relative animate-in zoom-in duration-500">
          <div className={`w-40 h-40 rounded-[3.5rem] bg-slate-900 border-4 border-${accent}-500 flex items-center justify-center text-6xl shadow-[0_0_80px_rgba(59,130,246,0.1)] relative`}>
             <div className="absolute inset-0 border-4 border-blue-500/20 rounded-[3.5rem] animate-ping"></div>
             {DEVICE_ICONS[router.type]}
          </div>
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-center">
             <div className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Gateway Root</div>
             <div className="text-[9px] mono text-slate-600 mt-1">{router.ip}</div>
          </div>
       </div>

       {/* Radial Nodes */}
       {nodes.map((node: any, idx: number) => {
          const angle = (idx / nodes.length) * 2 * Math.PI;
          const radius = 280;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;

          return (
            <div key={node.id} className="absolute inset-0 flex items-center justify-center pointer-events-none">
               <svg className="absolute w-full h-full pointer-events-none">
                  <path 
                    d={`M 50% 50% L calc(50% + ${x}px) calc(50% + ${y}px)`} 
                    stroke="currentColor" 
                    className={`text-${accent}-500/30`} 
                    strokeWidth="1" 
                    fill="none"
                  />
                  <circle r="4" fill="currentColor" className={`text-${accent}-500`}>
                    <animateMotion 
                      dur={`${2 + Math.random() * 2}s`} 
                      repeatCount="indefinite" 
                      path={`M 50% 50% L calc(50% + ${x}px) calc(50% + ${y}px)`} 
                    />
                  </circle>
               </svg>
               <div 
                style={{ transform: `translate(${x}px, ${y}px)` }}
                className={`w-24 h-24 rounded-[2.2rem] bg-slate-900 border-2 pointer-events-auto flex items-center justify-center text-3xl cursor-pointer hover:scale-110 transition-all ${selectedId === node.id ? `border-${accent}-500 shadow-2xl scale-110` : 'border-slate-800 hover:border-slate-700'}`}
                onClick={() => onSelect(node)}
               >
                  {DEVICE_ICONS[node.type]}
                  <div className="absolute -bottom-8 text-center w-max">
                     <div className="text-[9px] font-black uppercase text-slate-500">{node.hostname.split('-')[0]}</div>
                     <div className="text-[8px] mono text-slate-700">{node.ip}</div>
                  </div>
               </div>
            </div>
          );
       })}
    </div>
  );
};

const HistoryTab = ({ history, accent, onRestore }: any) => (
  <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
    <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-12">Network Archives</h2>
    {history.length === 0 ? (
       <div className="py-40 text-center bg-slate-900/50 rounded-[4rem] border-2 border-dashed border-slate-800">
          <i className="fas fa-box-archive text-7xl text-slate-800 mb-8"></i>
          <p className="text-slate-600 font-black uppercase tracking-[0.3em]">No historical data found</p>
       </div>
    ) : (
      history.map(item => (
        <div key={item.id} className="bg-slate-900 border border-slate-800 p-10 rounded-[3.5rem] flex items-center justify-between group hover:border-slate-700 transition-all hover:-translate-y-1">
          <div className="flex items-center gap-10">
             <div className={`w-20 h-20 rounded-[2rem] bg-slate-950 flex items-center justify-center text-3xl text-slate-700 group-hover:text-${accent}-500 transition-all`}>
                <i className="fas fa-calendar-check"></i>
             </div>
             <div>
                <div className="text-2xl font-black italic">{item.subnet}</div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Snapshot taken: {new Date(item.timestamp).toLocaleString()}</div>
             </div>
          </div>
          <div className="flex items-center gap-16">
             <div className="text-center">
                <div className="text-4xl font-black">{item.devicesFound}</div>
                <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Active Nodes</div>
             </div>
             <button onClick={() => onRestore(item.devices)} className={`h-16 px-10 rounded-2xl bg-slate-800 font-black text-[10px] uppercase tracking-widest hover:bg-${accent}-600 transition-all shadow-xl`}>Load Snapshot</button>
          </div>
        </div>
      ))
    )}
  </div>
);

const SettingsTab = ({ settings, onUpdate }: any) => (
  <div className="max-w-4xl mx-auto space-y-16 animate-in fade-in duration-500">
     <h2 className="text-4xl font-black uppercase italic tracking-tighter">System Console</h2>
     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 space-y-10">
           <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 italic">Interface Engine</h3>
           <ThemePicker current={settings.theme} onSelect={(v) => onUpdate({...settings, theme: v})} label="Refraction" val="glass" />
           <ThemePicker current={settings.theme} onSelect={(v) => onUpdate({...settings, theme: v})} label="Neon Flux" val="neon" />
           <ThemePicker current={settings.theme} onSelect={(v) => onUpdate({...settings, theme: v})} label="Industrial" val="industrial" />
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 space-y-10">
           <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 italic">Core Parameters</h3>
           <div className="flex flex-col gap-10">
              <ToggleRow label="Background Monitoring" desc="Autonomous scan every 5 minutes" active={settings.autoScan} onToggle={() => onUpdate({...settings, autoScan: !settings.autoScan})} />
              <ToggleRow label="AI Fingerprinting" desc="Use LLM for advanced OS detection" active={settings.detectOS} onToggle={() => onUpdate({...settings, detectOS: !settings.detectOS})} />
              <ToggleRow label="Real-time Alerts" desc="Notifications for unauthorized MACs" active={settings.showNotifications} onToggle={() => onUpdate({...settings, showNotifications: !settings.showNotifications})} />
           </div>
        </div>
     </div>
  </div>
);

const ThemePicker = ({ current, val, label, onSelect }: any) => (
  <button onClick={() => onSelect(val)} className={`w-full p-6 rounded-3xl border-2 text-left transition-all ${current === val ? 'border-blue-500 bg-blue-600/10 shadow-2xl' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}>
     <div className="text-lg font-black uppercase italic mb-1">{label}</div>
     <div className="flex gap-1.5">
        <div className={`w-3 h-3 rounded-full ${val === 'neon' ? 'bg-blue-400 shadow-[0_0_5px_#3b82f6]' : 'bg-slate-700'}`}></div>
        <div className={`w-3 h-3 rounded-full ${val === 'neon' ? 'bg-purple-400 shadow-[0_0_5px_#a855f7]' : 'bg-slate-800'}`}></div>
     </div>
  </button>
);

const ToggleRow = ({ label, desc, active, onToggle }: any) => (
  <div className="flex items-center justify-between">
     <div>
        <div className="text-sm font-black uppercase italic">{label}</div>
        <p className="text-[10px] text-slate-500 mt-1 font-bold">{desc}</p>
     </div>
     <button onClick={onToggle} className={`w-14 h-8 rounded-full p-1.5 transition-colors relative shadow-inner ${active ? 'bg-blue-600' : 'bg-slate-800'}`}>
        <div className={`w-5 h-5 bg-white rounded-full shadow-lg transition-transform ${active ? 'translate-x-6' : 'translate-x-0'}`}></div>
     </button>
  </div>
);

const DataField = ({ label, value, mono, color }: any) => (
  <div className="space-y-1.5">
    <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest italic">{label}</div>
    <div className={`text-xs font-bold ${mono ? `mono text-${color}-400` : 'text-slate-100'}`}>{value}</div>
  </div>
);

export default App;
