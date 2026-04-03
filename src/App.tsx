import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  CalendarDays, 
  Layers,
  ArrowRight,
  Database,
  Route,
  ClipboardList,
  PlusCircle,
  Play,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Info,
  BarChart3,
  Activity,
  Zap,
  RefreshCw
} from 'lucide-react';

// --- TYPES ---
interface MachineGroup { id: string; name: string; }
interface Machine { id: string; name: string; type: string; maxCapacity?: number; groupId?: string; }

interface RouteStep { seq: number; machineId: string; operation: string; waitTime?: number; }
interface Routing { 
  id: string; 
  name: string; 
  cableType?: string; 
  coreCount?: string; 
  conductorSize?: string; 
  steps: RouteStep[]; 
}
interface WorkOrder { 
  id: string; 
  cableDetails: string; 
  routingId: string; 
  qty: number; 
  startDate: string; 
  dueDate: string; 
  isUrgent: boolean; 
  materialStatus: 'Available' | 'Pending';
  priorityNumber?: number;
}
interface GlobalScheduleStep {
  workOrderId: string;
  cableDetails: string;
  isUrgent: boolean;
  machineId: string;
  operation: string;
  startDate: Date;
  endDate: Date;
  totalDurMins: number;
  isBottleneck: boolean;
}

// --- PERSISTENCE HOOK ---
function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
       console.error(error);
       return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };
  return [storedValue, setValue] as const;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [scheduledGanttData, setScheduledGanttData] = useState<GlobalScheduleStep[]>([]);
  const [schedConfig, setSchedConfig] = useState({ direction: 'Forward', sortRule: 'DueDate' });
  const [hoveredJob, setHoveredJob] = useState<{ job: GlobalScheduleStep, x: number, y: number } | null>(null);

  // --- PERSISTENT DATABASES (State) ---
  const [machineGroups, setMachineGroups] = useLocalStorage<MachineGroup[]>('opcenter_groups', [
    { id: 'GRP-EXT', name: 'Extrusion Lines' },
    { id: 'GRP-ARM', name: 'Armouring Lines' }
  ]);

  const [machines, setMachines] = useLocalStorage<Machine[]>('opcenter_machines', [
    { id: 'STR-61', name: '61 B Stranding', maxCapacity: 50000, type: 'Conductor' },
    { id: 'EXT-70', name: 'Extruder 70mm Ins.', maxCapacity: 100000, type: 'Extrusion' },
    { id: 'DRM-TW', name: 'Drum Twister', maxCapacity: 30000, type: 'Twisting' },
    { id: 'EXT-100', name: 'Extruder 100mm Jack.', maxCapacity: 80000, type: 'Extrusion' },
    { id: 'ARM-72', name: 'Armouring 72B', maxCapacity: 20000, type: 'Armouring' },
    { id: 'EXT-120', name: 'Extruder 120mm Jack.', maxCapacity: 40000, type: 'Extrusion' },
  ]);

  const [routings, setRoutings] = useLocalStorage<Routing[]>('opcenter_routings', [
    {
      id: 'PATH-001',
      name: '3C x 95 sq.mm Armoured Standard',
      steps: [
        { seq: 1, machineId: 'STR-61', operation: 'Stranding', waitTime: 0 },
        { seq: 2, machineId: 'EXT-70', operation: 'Core Insulation', waitTime: 120 }, 
        { seq: 3, machineId: 'DRM-TW', operation: 'Laying Up', waitTime: 0 },
        { seq: 4, machineId: 'EXT-100', operation: 'Inner Sheath', waitTime: 60 },
        { seq: 5, machineId: 'ARM-72', operation: 'Wire Armouring', waitTime: 0 },
        { seq: 6, machineId: 'EXT-120', operation: 'Outer Sheath', waitTime: 0 }
      ]
    }
  ]);

  const defaultNextWeek = new Date();
  defaultNextWeek.setDate(defaultNextWeek.getDate() + 7);

  const [workOrders, setWorkOrders] = useLocalStorage<WorkOrder[]>('opcenter_orders', [
    { id: 'WO-BHEL', cableDetails: '3C x 95 sq.mm Armoured Power', routingId: 'PATH-001', qty: 10000, startDate: new Date().toISOString().split('T')[0], dueDate: defaultNextWeek.toISOString().split('T')[0], isUrgent: false, materialStatus: 'Available', priorityNumber: 2 },
    { id: 'WO-TATA', cableDetails: '4C x 70 sq.mm Standard', routingId: 'PATH-001', qty: 15000, startDate: new Date().toISOString().split('T')[0], dueDate: defaultNextWeek.toISOString().split('T')[0], isUrgent: false, materialStatus: 'Pending', priorityNumber: 1 }
  ]);

  // --- FORM STATES ---
  const [newGroup, setNewGroup] = useState<MachineGroup>({ id: '', name: '' });
  const [newMach, setNewMach] = useState<Machine>({ id: '', name: '', maxCapacity: 10000, type: 'Extrusion', groupId: '' });
  const [newRoute, setNewRoute] = useState<Routing>({ id: '', name: '', cableType: '', coreCount: '', conductorSize: '', steps: [] });
  const [newWO, setNewWO] = useState<WorkOrder>({ id: '', cableDetails: '', routingId: '', qty: 10000, startDate: new Date().toISOString().split('T')[0], dueDate: new Date((new Date()).getTime() + 7*86400000).toISOString().split('T')[0], isUrgent: false, materialStatus: 'Available', priorityNumber: 1 });

  // --- ACTIONS ---
    const handleAddGroup = () => {
    if(!newGroup.id || !newGroup.name) return;
    setMachineGroups([...machineGroups, { ...newGroup }]);
    setNewGroup({ id: '', name: '' });
  };
  const handleDeleteGroup = (id: string) => { setMachineGroups(machineGroups.filter(g => g.id !== id)); };

  const handleAddMachine = () => {
    if(!newMach.id || !newMach.name) return;
    setMachines([...machines, { ...newMach }]);
    setNewMach({ id: '', name: '', maxCapacity: 10000, type: 'Extrusion', groupId: '' });
  };
  const handleDeleteMachine = (id: string) => { setMachines(machines.filter(m => m.id !== id)); };

  const handleSaveRoute = () => {
    if(!newRoute.id || !newRoute.name || newRoute.steps.length === 0) return;
    setRoutings([...routings, { ...newRoute }]);
    setNewRoute({ id: '', name: '', cableType: '', coreCount: '', conductorSize: '', steps: [] });
  };
  const handleDeleteRoute = (id: string) => { setRoutings(routings.filter(r => r.id !== id)); };

  const handleAddWorkOrder = () => {
    if(!newWO.id || !newWO.cableDetails || !newWO.routingId) return;
    setWorkOrders([...workOrders, { ...newWO }]);
    setNewWO({ id: '', cableDetails: '', routingId: '', qty: 10000, startDate: new Date().toISOString().split('T')[0], dueDate: new Date((new Date()).getTime() + 7*86400000).toISOString().split('T')[0], isUrgent: false, materialStatus: 'Available', priorityNumber: 1 });
  };
  const handleDeleteWorkOrder = (id: string) => { setWorkOrders(workOrders.filter(o => o.id !== id)); };

  const simulateERPSync = () => {
    const updated = workOrders.map(wo => wo.materialStatus === 'Pending' ? { ...wo, materialStatus: 'Available' as 'Available' } : wo);
    setWorkOrders(updated);
    alert('ERP Sync Simulated: All pending materials are now marked as available.');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        const bstr = evt.target?.result as string;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const data = XLSX.utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]]);
        const newOrders = data.map((row: any, index: number) => ({
            id: row['Work Order #'] || `WO-IMPORT-${index}`,
            cableDetails: row['Cable Properties'] || '',
            routingId: row['Map Path'] || '',
            qty: Number(row['Target Quantity (Meters)']) || 0,
            startDate: row['Start Strategy Date'] ? new Date(row['Start Strategy Date']).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            dueDate: row['Delivery Deadline'] ? new Date(row['Delivery Deadline']).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            isUrgent: row['Prioritize as Urgent'] === 'Yes' || row['Prioritize as Urgent'] === true || false,
            materialStatus: row['Material State'] || 'Pending',
            priorityNumber: Number(row['Priority Number']) || 999
        }));
        setWorkOrders([...workOrders, ...newOrders]);
    };
    reader.readAsBinaryString(file);
  };

  const executeSchedule = () => {
    let sortedWOs = [...workOrders].filter(wo => wo.materialStatus !== 'Pending');
    sortedWOs.sort((a, b) => {
        if (a.isUrgent && !b.isUrgent) return -1;
        if (!a.isUrgent && b.isUrgent) return 1;
        if (schedConfig.sortRule === 'MaxQuantity') return b.qty - a.qty;
        if (schedConfig.sortRule === 'Priority') return (a.priorityNumber || 999) - (b.priorityNumber || 999);
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(); // default DueDate
    });

    let machAvail: Record<string, number> = {};
    let jobs: GlobalScheduleStep[] = [];

    const DEFAULT_SPEED = 100;
    const DEFAULT_SETUP = 60;
    
    const baseDate = new Date();
    baseDate.setHours(8, 0, 0, 0); 
    const baseTime = baseDate.getTime(); 

    sortedWOs.forEach(wo => {
        let route = routings.find(r => r.id === wo.routingId);
        if (!route) return;
        
        let pathTime = baseTime;
        const woStart = new Date(wo.startDate).getTime();
        if (woStart > pathTime) pathTime = woStart;
        
        const backwardBase = new Date(wo.dueDate).getTime();
        
        let stepJobs: GlobalScheduleStep[] = [];
        let backwardCursor = backwardBase;
        
        const assignMachine = (reqId: string): string => {
             const groupMatch = machineGroups.find(g => g.id === reqId);
             if(!groupMatch) return reqId; // It's already a specific machine
             
             const options = machines.filter(m => m.groupId === reqId);
             if(options.length === 0) return reqId; // Fallback to raw string if cluster is empty
             
             // Pick the earliest available
             options.sort((a,b) => (machAvail[a.id] || baseTime) - (machAvail[b.id] || baseTime));
             return options[0].id;
        };
        
        if(schedConfig.direction === 'Backward') {
             for (let i = route.steps.length - 1; i >= 0; i--) {
                const s = route.steps[i];
                let dur = (wo.qty / DEFAULT_SPEED) + DEFAULT_SETUP;
                let end = backwardCursor;
                let start = end - dur * 60000;
                let selectedMach = assignMachine(s.machineId);
                
                stepJobs.unshift({
                    workOrderId: wo.id, cableDetails: wo.cableDetails, machineId: selectedMach, operation: s.operation,
                    isUrgent: wo.isUrgent, isBottleneck: false, totalDurMins: dur,
                    startDate: new Date(start), endDate: new Date(end)
                });
                backwardCursor = start - (s.waitTime||0)*60000;
             }
             jobs.push(...stepJobs);
        } else {
            route.steps.forEach(s => {
                let dur = (wo.qty / DEFAULT_SPEED) + DEFAULT_SETUP;
                let selectedMach = assignMachine(s.machineId);
                let machReady = machAvail[selectedMach] || baseTime;
                let actualStart = Math.max(pathTime, machReady);
                let actualEnd = actualStart + dur * 60000;
                
                jobs.push({
                    workOrderId: wo.id, cableDetails: wo.cableDetails, machineId: selectedMach, operation: s.operation,
                    isUrgent: wo.isUrgent, isBottleneck: pathTime < machReady, totalDurMins: dur,
                    startDate: new Date(actualStart), endDate: new Date(actualEnd)
                });
                
                machAvail[selectedMach] = actualEnd;
                pathTime = actualEnd + (s.waitTime || 0) * 60000;
            });
        }
    });

    setScheduledGanttData(jobs);
  };

  const minGanttTime = useMemo(() => scheduledGanttData.length > 0 ? Math.min(...scheduledGanttData.map(s => s.startDate.getTime())) : new Date().getTime(), [scheduledGanttData]);
  const maxGanttTime = useMemo(() => scheduledGanttData.length > 0 ? Math.max(...scheduledGanttData.map(s => s.endDate.getTime())) : new Date().getTime() + 86400000, [scheduledGanttData]);
  const totalGanttDurMs = maxGanttTime - minGanttTime || 1;

  const computeMachineLoad = () => {
    const loadCalc: Record<string, number> = {};
    machines.forEach(m => loadCalc[m.id] = 0);
    scheduledGanttData.forEach(step => {
        if (loadCalc[step.machineId] !== undefined) {
            loadCalc[step.machineId] += step.totalDurMins / 60;
        }
    });
    return Object.entries(loadCalc).map(([id, hours]) => {
      const nm = machines.find(m => m.id === id)?.name || id;
      return { id, name: nm, hours };
    }).sort((a,b) => b.hours - a.hours);
  };

  const menuItems = [
    { id: 'dashboard', label: 'Global Dashboard', icon: <BarChart3 size={18}/> },
    { id: 'groups', label: 'Resource Groups', icon: <Layers size={18}/> },
    { id: 'gantt', label: 'Execution Gantt', icon: <CalendarDays size={18}/> },
    { id: 'orders', label: 'Work Orders', icon: <ClipboardList size={18}/> },
    { id: 'routes', label: 'Routing Masters', icon: <Route size={18}/> },
    { id: 'machines', label: 'Machine Database', icon: <Database size={18}/> }
  ];

  const inputStyle: React.CSSProperties = { padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.05)', color: 'white', width: '100%', boxSizing: 'border-box' };
  const btnStyle: React.CSSProperties = { padding: '12px 20px', borderRadius: '8px', background: 'var(--accent-blue)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', transition: 'all 0.2s' };
  const deleteBtnStyle: React.CSSProperties = { background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div className="glass-panel" style={{ padding: '8px', borderRadius: '8px', background: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(0, 102, 255, 0.4)' }}>
            <Layers size={24} color="white" />
          </div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 'bold' }}>OpCenter <span style={{ color: 'var(--accent-cyan)' }}>Cable</span></h1>
        </div>

        <nav>
          {menuItems.map(m => (
            <div key={m.id} onClick={() => setActiveTab(m.id)} className={`nav-item ${activeTab === m.id ? 'active' : ''}`}>
              {m.icon}
              {m.label}
            </div>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', padding: '16px 0 0 0', borderTop: '1px solid var(--border-glass)' }}>
          <div className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            <Info size={18}/>
            System Overview
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="header">
          <h2>Platform Overview v2.0.0</h2>
          <div className="header-actions">
            <button onClick={simulateERPSync} style={{ ...btnStyle, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-glass)' }}>
               <RefreshCw size={16}/> Simulate ERP Sync
            </button>
          </div>
        </header>

        {/* 1. GLOBAL DASHBOARD */}
        {activeTab === 'dashboard' && (
           <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="glass-panel" style={{ padding: '32px', position: 'relative', overflow: 'hidden' }}>
                 <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', background: 'var(--accent-cyan)', filter: 'blur(100px)', opacity: 0.1, borderRadius: '50%' }}></div>
                 <h2 style={{ color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Activity size={24} /> OpCenter Cable APS v2.0
                 </h2>
                 <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '800px' }}>
                   Dynamic, constraint-based advanced planning and scheduling explicitly modeled for cable manufacturing capacities. Engine automatically re-prioritizes around target dates and urgent job flags.
                 </p>
              </div>

              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                <div className="glass-panel" style={{ flex: '1 1 300px', padding: '24px' }}>
                   <h3 style={{ marginBottom: '16px' }}>Active Pipeline Variables</h3>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Total Queue Metreage</span>
                        <strong style={{ fontSize: '1.2rem', color: 'var(--accent-cyan)' }}>{workOrders.reduce((acc,wo)=>acc+wo.qty,0).toLocaleString()} m</strong>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Pending Materials</span>
                        <strong style={{ fontSize: '1.2rem', color: 'orange' }}>{workOrders.filter(w=>w.materialStatus==='Pending').length} Orders</strong>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Urgent Action Items</span>
                        <strong style={{ fontSize: '1.2rem', color: '#ef4444' }}>{workOrders.filter(w=>w.isUrgent).length} Critical</strong>
                     </div>
                   </div>
                </div>

                <div className="glass-panel" style={{ flex: '1 1 300px', padding: '24px' }}>
                   <h3 style={{ marginBottom: '16px' }}>Machine Capacity Load (Hours)</h3>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                     {computeMachineLoad().slice(0, 4).map(l => (
                        <div key={l.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                             <span style={{ color: 'var(--text-secondary)' }}>{l.name}</span>
                             <span>{l.hours.toFixed(1)} hrs</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: 'var(--bg-primary)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min((l.hours / 40) * 100, 100)}%`, background: 'var(--accent-blue)', borderRadius: '4px' }}></div>
                          </div>
                        </div>
                     ))}
                   </div>
                </div>
              </div>
           </div>
        )}

        {/* 2. GANTT / APS BOARD */}
        {activeTab === 'gantt' && (
           <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ margin: 0 }}>Global Scheduling Visualization</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '12px', background: 'var(--accent-blue)', borderRadius: '2px' }}></div><span style={{ fontSize: '0.85rem' }}>Normal Run</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '12px', background: '#e11d48', borderRadius: '2px' }}></div><span style={{ fontSize: '0.85rem' }}>Urgent Overwrite</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '12px', border: '2px dashed orange', borderRadius: '2px' }}></div><span style={{ fontSize: '0.85rem' }}>Wait Constraint (Bottleneck)</span></div>
                </div>
              </div>

              <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                 <div>
                    <label style={{display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px'}}>Scheduling Direction</label>
                    <select value={schedConfig.direction} onChange={e=>setSchedConfig({...schedConfig, direction: e.target.value})} style={inputStyle}>
                        <option value="Forward">Forward Scheduling</option>
                        <option value="Backward">Backward Scheduling</option>
                    </select>
                 </div>
                 <div>
                    <label style={{display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px'}}>Prioritization Rule</label>
                    <select value={schedConfig.sortRule} onChange={e=>setSchedConfig({...schedConfig, sortRule: e.target.value})} style={inputStyle}>
                        <option value="DueDate">Earliest Due Date</option>
                        <option value="Priority">Priority Number</option>
                        <option value="MaxQuantity">Max Quantity (Highest first)</option>
                    </select>
                 </div>
                 <button onClick={executeSchedule} style={{...btnStyle, background: 'var(--accent-blue)'}}><Play size={16}/> Execute Schedule</button>
              </div>

              {scheduledGanttData.length === 0 && <div style={{textAlign: 'center', padding: '40px', color: 'var(--text-secondary)'}}>Click 'Execute Schedule' to build the Gantt view.</div>}

              {scheduledGanttData.length > 0 && (
                <>
                {/* Timeline X-Axis */}
                <div style={{ position: 'relative', height: '24px', borderBottom: '1px solid var(--border-glass)', marginBottom: '16px', marginLeft: '220px' }}>
                    {Array.from({length: 11}).map((_, i) => (
                        <span key={i} style={{ position: 'absolute', left: `${i * 10}%`, fontSize: '0.75rem', color: 'var(--text-secondary)', transform: 'translateX(-50%)' }}>Day {i}</span>
                    ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowX: 'auto', paddingBottom: '20px' }}>
                  {machines.map(m => {
                    const machineJobs = scheduledGanttData.filter(s => s.machineId === m.id);
                    return (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '8px' }}>
                        <div style={{ width: '200px', flexShrink: 0, paddingRight: '20px' }}>
                           <h4 style={{ margin: 0, fontSize: '0.9rem' }}>{m.name}</h4>
                           <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{m.id}</span>
                        </div>
                        <div style={{ flex: 1, height: '40px', position: 'relative', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                           {machineJobs.map((job, idx) => {
                             const leftPct = ((job.startDate.getTime() - minGanttTime) / totalGanttDurMs) * 100;
                             const widthPct = ((job.endDate.getTime() - job.startDate.getTime()) / totalGanttDurMs) * 100;
                             
                             return (
                               <div 
                                 key={idx} 
                                 onMouseEnter={(e) => setHoveredJob({ job, x: e.clientX, y: e.clientY })}
                                 onMouseMove={(e) => setHoveredJob({ job, x: e.clientX, y: e.clientY })}
                                 onMouseLeave={() => setHoveredJob(null)}
                                 style={{ position: 'absolute', left: `${leftPct}%`, width: `${widthPct}%`, height: '100%', background: job.isUrgent ? 'linear-gradient(45deg, #e11d48, #be123c)' : 'linear-gradient(45deg, #0066ff, #00d2ff)', borderRadius: '4px', border: job.isBottleneck ? '2px dashed orange' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', color: 'white', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', padding: '0 4px', boxShadow: job.isUrgent ? '0 0 15px rgba(225, 29, 72, 0.4)' : 'none', zIndex: 10, cursor: 'crosshair' }}
                               >
                                 {job.workOrderId.split('-')[1]}
                               </div>
                             );
                           })}
                        </div>
                      </div>
                    )
                  })}
                </div>

               {hoveredJob && (
                  <div style={{ position: 'fixed', left: hoveredJob.x + 15, top: hoveredJob.y + 15, background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '12px', borderRadius: '8px', zIndex: 9999, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', pointerEvents: 'none', width: 'max-content', fontSize: '0.8rem', color: 'white' }}>
                     <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '6px', color: 'var(--accent-cyan)' }}>{hoveredJob.job.workOrderId}</div>
                     <div style={{ marginBottom: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{hoveredJob.job.cableDetails}</div>
                     <div style={{ display: 'grid', gridTemplateColumns: 'min-content 1fr', gap: '4px 12px' }}>
                        <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Operation:</span> <span>{hoveredJob.job.operation}</span>
                        <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Asset ID:</span> <span>{hoveredJob.job.machineId}</span>
                        <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Duration:</span> <span>{hoveredJob.job.totalDurMins.toFixed(0)} mins</span>
                     </div>
                     <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-glass)', display: 'grid', gridTemplateColumns: 'min-content 1fr', gap: '4px 12px' }}>
                        <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Start:</span> <span>{hoveredJob.job.startDate.toLocaleString()}</span>
                        <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>End:</span> <span>{hoveredJob.job.endDate.toLocaleString()}</span>
                     </div>
                     {(hoveredJob.job.isUrgent || hoveredJob.job.isBottleneck) && (
                        <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                            {hoveredJob.job.isUrgent && <span style={{ background: '#e11d48', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>Urgent Flag</span>}
                            {hoveredJob.job.isBottleneck && <span style={{ border: '1px dashed orange', color: 'orange', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>Wait Bottleneck</span>}
                        </div>
                     )}
                  </div>
               )}

                </>
              )}
           </div>
        )}

                {/* RESOURCE GROUPS */}
        {activeTab === 'groups' && (
           <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
             <div className="glass-panel" style={{ flex: '1 1 500px', padding: '24px' }}>
               <h3 style={{ marginBottom: '16px' }}>Resource Groups Database</h3>
               <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                 <thead>
                   <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                     <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Group ID</th>
                     <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Group Name</th>
                     <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Qty Machines</th>
                     <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Action</th>
                   </tr>
                 </thead>
                 <tbody>
                   {machineGroups.map(g => (
                     <tr key={g.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                       <td style={{ padding: '12px 8px', color: 'var(--accent-cyan)' }}>{g.id}</td>
                       <td style={{ padding: '12px 8px', fontWeight: 500 }}>{g.name}</td>
                       <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{machines.filter(m => m.groupId === g.id).length} Linked</td>
                       <td style={{ padding: '12px 8px' }}>
                         <button onClick={() => handleDeleteGroup(g.id)} style={deleteBtnStyle} title="Delete Group"><Trash2 size={16} /></button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
             
             <div className="glass-panel" style={{ width: '400px', padding: '24px', height: 'fit-content', flexShrink: 0 }}>
               <h3 style={{ marginBottom: '16px' }}>Add New Group</h3>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Group ID</label>
                    <input placeholder="e.g. GRP-EXT" value={newGroup.id} onChange={e=>setNewGroup({...newGroup, id: e.target.value})} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Group Name</label>
                    <input placeholder="e.g. Extrusion Cluster" value={newGroup.name} onChange={e=>setNewGroup({...newGroup, name: e.target.value})} style={inputStyle} />
                  </div>
                 <button onClick={handleAddGroup} style={{...btnStyle, marginTop: '8px'}}><PlusCircle size={16}/> Save Group Master</button>
               </div>
             </div>
           </div>
        )}

        {/* 3. MACHINE DATABASE */}
        {activeTab === 'machines' && (
           <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
             <div className="glass-panel" style={{ flex: '1 1 500px', padding: '24px' }}>
               <h3 style={{ marginBottom: '16px' }}>Machine Asset Registry</h3>
               <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                 <thead>
                   <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                     <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>ID</th>
                     <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Name</th>
                     <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Group</th>
                     <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Max Cap</th>
                     <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Action</th>
                   </tr>
                 </thead>
                 <tbody>
                   {machines.map(m => (
                     <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                       <td style={{ padding: '12px 8px', color: 'var(--accent-cyan)' }}>{m.id}</td>
                       <td style={{ padding: '12px 8px', fontWeight: 500 }}>{m.name}</td>
                       <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{m.groupId || '-'}</td>
                       <td style={{ padding: '12px 8px', color: '#10b981' }}>{m.maxCapacity ? m.maxCapacity.toLocaleString() + ' m' : 'N/A'}</td>
                       <td style={{ padding: '12px 8px' }}>
                         <button onClick={() => handleDeleteMachine(m.id)} style={deleteBtnStyle} title="Delete Machine"><Trash2 size={16} /></button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
             
             <div className="glass-panel" style={{ width: '400px', padding: '24px', height: 'fit-content', flexShrink: 0 }}>
               <h3 style={{ marginBottom: '16px' }}>Add New Machine</h3>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Machine ID</label>
                    <input placeholder="e.g. BUN-200" value={newMach.id} onChange={e=>setNewMach({...newMach, id: e.target.value})} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Machine Name</label>
                    <input placeholder="e.g. Buncher" value={newMach.name} onChange={e=>setNewMach({...newMach, name: e.target.value})} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Resource Group</label>
                    <select value={newMach.groupId || ''} onChange={e=>setNewMach({...newMach, groupId: e.target.value})} style={inputStyle}>
                       <option value="">-- No Group assigned --</option>
                       {machineGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Max Capacity</label>
                    <input type="number" placeholder="e.g. 50000" value={newMach.maxCapacity || ''} onChange={e=>setNewMach({...newMach, maxCapacity: Number(e.target.value)})} style={inputStyle} />
                  </div>
                 <button onClick={handleAddMachine} style={{...btnStyle, marginTop: '8px'}}><PlusCircle size={16}/> Save Machine Data</button>
               </div>
             </div>
           </div>
        )}

        {/* 4. ROUTING LOGIC  */}
        {activeTab === 'routes' && (
           <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
             <div className="glass-panel" style={{ flex: '1 1 400px', padding: '24px' }}>
               <h2 style={{ marginBottom: '16px' }}>Saved Sequences (SOPs)</h2>
               {routings.length === 0 && <div style={{ opacity: 0.5 }}>No routing masters created.</div>}
               {routings.map(r => (
                 <div key={r.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', marginBottom: '16px', borderLeft: '3px solid var(--accent-blue)', position: 'relative' }}>
                   <button onClick={() => handleDeleteRoute(r.id)} style={{...deleteBtnStyle, position: 'absolute', top: '16px', right: '16px'}} title="Delete Path"><Trash2 size={16} /></button>
                   <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '12px', paddingRight: '40px' }}>
                      <h3 style={{ margin: 0, color: 'var(--accent-cyan)' }}>{r.id}: {r.name}</h3>
                      {(r.cableType || r.coreCount || r.conductorSize) && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                           {r.cableType && <span>Cable: {r.cableType} | </span>}
                           {r.coreCount && <span>Cores: {r.coreCount} | </span>}
                           {r.conductorSize && <span>Size: {r.conductorSize}</span>}
                        </div>
                      )}
                    </div>
                   <div style={{ display: 'flex', overflowX: 'auto', gap: '8px', paddingBottom: '8px' }}>
                     {r.steps.map((s, i) => (
                       <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                         <div style={{ background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid var(--border-glass)', textAlign: 'center' }}>
                           <strong style={{ color: 'white' }}>{s.machineId}</strong> <br/> <span style={{ color: 'var(--text-secondary)' }}>{s.operation}</span>
                         </div>
                         {i < r.steps.length - 1 && (
                           <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', color: 'var(--text-secondary)' }}>
                             <ArrowRight size={14} />
                             {s.waitTime ? <span style={{fontSize: '0.6rem', color: 'orange'}}>{s.waitTime}m wait</span> : null}
                           </div>
                         )}
                       </div>
                     ))}
                   </div>
                 </div>
               ))}
             </div>

             <div style={{ backgroundColor: '#f2f4f7', padding: '12px', border: '1px solid #7a98b1', flex: '1 1 500px', flexShrink: 0, fontFamily: 'Arial, sans-serif' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#d0daf0', border: '1px solid #7a98b1', padding: '4px 12px', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, color: '#333', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Info size={16}/> Create Routing Master</h3>
                    <button onClick={handleSaveRoute} style={{ backgroundColor: '#f2f2f2', border: '1px solid #7a98b1', padding: '2px 12px', cursor: 'pointer', color: '#333', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={14}/> Save Master</button>
                </div>
            
                <div style={{ backgroundColor: '#dee3f2', border: '1px solid #7a98b1', padding: '8px', marginBottom: '8px' }}>
                    <div style={{ backgroundColor: '#c4d6eb', borderBottom: '1px solid #7a98b1', padding: '4px 8px', fontSize: '0.85rem', fontWeight: 'bold', color: '#333', margin: '-8px -8px 8px -8px' }}>Header Data</div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'min-content 1fr min-content 1fr', gap: '8px 16px', alignItems: 'center' }}>
                        <label style={{ color: '#333', fontSize: '0.8rem', width: '120px', flexShrink: 0 }}>Routing Number</label>
                        <input value={newRoute.id} onChange={e=>setNewRoute({...newRoute, id: e.target.value})} style={{ padding: '4px', border: '1px solid #7a98b1', borderRadius: '0', backgroundColor: 'white', color: 'black', fontSize: '0.8rem', width: '100%' }} />
                        <label style={{ color: '#333', fontSize: '0.8rem', width: '120px', flexShrink: 0 }}>Description</label>
                        <input value={newRoute.name} onChange={e=>setNewRoute({...newRoute, name: e.target.value})} style={{ padding: '4px', border: '1px solid #7a98b1', borderRadius: '0', backgroundColor: 'white', color: 'black', fontSize: '0.8rem', width: '100%' }} />
                        
                        <label style={{ color: '#333', fontSize: '0.8rem', width: '120px', flexShrink: 0 }}>Cable Type</label>
                        <input value={newRoute.cableType || ''} onChange={e=>setNewRoute({...newRoute, cableType: e.target.value})} style={{ padding: '4px', border: '1px solid #7a98b1', borderRadius: '0', backgroundColor: 'white', color: 'black', fontSize: '0.8rem', width: '100%' }} />
                        <label style={{ color: '#333', fontSize: '0.8rem', width: '120px', flexShrink: 0 }}>Core Count</label>
                        <input value={newRoute.coreCount || ''} onChange={e=>setNewRoute({...newRoute, coreCount: e.target.value})} style={{ padding: '4px', border: '1px solid #7a98b1', borderRadius: '0', backgroundColor: 'white', color: 'black', fontSize: '0.8rem', width: '100%' }} />
            
                        <label style={{ color: '#333', fontSize: '0.8rem', width: '120px', flexShrink: 0 }}>Conductor Size</label>
                        <input value={newRoute.conductorSize || ''} onChange={e=>setNewRoute({...newRoute, conductorSize: e.target.value})} style={{ padding: '4px', border: '1px solid #7a98b1', borderRadius: '0', backgroundColor: 'white', color: 'black', fontSize: '0.8rem', width: '100%' }} />
                    </div>
                </div>
            
                <div style={{ backgroundColor: '#dee3f2', border: '1px solid #7a98b1', padding: '8px', marginBottom: '8px' }}>
                    <div style={{ backgroundColor: '#c4d6eb', borderBottom: '1px solid #7a98b1', padding: '4px 8px', fontSize: '0.85rem', fontWeight: 'bold', color: '#333', margin: '-8px -8px 8px -8px', display:'flex', justifyContent:'space-between' }}>
                         <span>Item Data (Sequence)</span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', border: '1px solid #7a98b1' }}>
                        <thead style={{ backgroundColor: '#ebf0f9' }}>
                        <tr>
                            <th style={{ border: '1px solid #7a98b1', padding: '4px', color: '#333', width: '40px', fontSize: '0.8rem', textAlign: 'center' }}>Seq</th>
                            <th style={{ border: '1px solid #7a98b1', padding: '4px', color: '#333', fontSize: '0.8rem', textAlign: 'left' }}>Machine</th>
                            <th style={{ border: '1px solid #7a98b1', padding: '4px', color: '#333', fontSize: '0.8rem', textAlign: 'left' }}>Operation Std</th>
                            <th style={{ border: '1px solid #7a98b1', padding: '4px', color: '#333', width: '80px', fontSize: '0.8rem', textAlign: 'left' }}>Wait (m)</th>
                            <th style={{ border: '1px solid #7a98b1', padding: '4px', color: '#333', width: '40px', fontSize: '0.8rem', textAlign: 'center' }}>Del</th>
                        </tr>
                        </thead>
                        <tbody>
                        {newRoute.steps.map((s, idx) => (
                            <tr key={idx}>
                                <td style={{ border: '1px solid #7a98b1', padding: '0', textAlign: 'center', color: '#333', fontSize: '0.8rem' }}>{idx + 1}</td>
                                <td style={{ border: '1px solid #7a98b1', padding: '0' }}>
                                    <select value={s.machineId} onChange={e => {
                                            const newSteps = [...newRoute.steps];
                                            newSteps[idx].machineId = e.target.value;
                                            setNewRoute({...newRoute, steps: newSteps});
                                    }} style={{ width: '100%', padding: '4px', border: 'none', backgroundColor: 'transparent', color: 'black', fontSize: '0.8rem' }}>
                                        <option value="">-- Select --</option>
                                        <optgroup label="Resource Groups">
                                           {machineGroups.map(g => <option key={g.id} value={g.id}>{g.id} ({g.name})</option>)}
                                        </optgroup>
                                        <optgroup label="Specific Machines">
                                           {machines.map(m => <option key={m.id} value={m.id}>{m.id} ({m.name})</option>)}
                                        </optgroup>
                                    </select>
                                </td>
                                <td style={{ border: '1px solid #7a98b1', padding: '0' }}>
                                    <input value={s.operation} onChange={e => {
                                            const newSteps = [...newRoute.steps];
                                            newSteps[idx].operation = e.target.value;
                                            setNewRoute({...newRoute, steps: newSteps});
                                    }} style={{ width: '100%', padding: '4px', border: 'none', backgroundColor: 'transparent', color: 'black', fontSize: '0.8rem' }} />
                                </td>
                                <td style={{ border: '1px solid #7a98b1', padding: '0' }}>
                                    <input type="number" value={s.waitTime || ''} onChange={e => {
                                            const newSteps = [...newRoute.steps];
                                            newSteps[idx].waitTime = Number(e.target.value);
                                            setNewRoute({...newRoute, steps: newSteps});
                                    }} style={{ width: '100%', padding: '4px', border: 'none', backgroundColor: 'transparent', color: 'black', fontSize: '0.8rem' }} />
                                </td>
                                <td style={{ border: '1px solid #7a98b1', padding: '0', textAlign: 'center' }}>
                                    <button onClick={() => {
                                        const newSteps = newRoute.steps.filter((_, i) => i !== idx).map((st, i) => ({...st, seq: i+1}));
                                        setNewRoute({...newRoute, steps: newSteps});
                                    }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#c0392b', fontWeight: 'bold' }}>X</button>
                                </td>
                            </tr>
                        ))}
                        <tr>
                            <td style={{ border: '1px solid #7a98b1', padding: '4px', textAlign: 'center', color: '#555' }}>*</td>
                            <td colSpan={4} style={{ border: '1px solid #7a98b1', padding: '4px' }}>
                                <button onClick={() => setNewRoute({...newRoute, steps: [...newRoute.steps, { seq: newRoute.steps.length+1, machineId: '', operation: '', waitTime: 0 }]})} style={{ border: '1px solid #ccc', padding: '2px 8px', background: '#e0e0e0', cursor: 'pointer', color: '#333', fontSize: '0.8rem' }}>+ Add Row</button>
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </div>
              </div>
           </div>
        )}

        {/* 5. WORK ORDERS */}
        {activeTab === 'orders' && (
           <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
             <div className="glass-panel" style={{ flex: '1 1 500px', padding: '24px' }}>
               <h3 style={{ marginBottom: '16px' }}>Order Pipeline</h3>
               <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                 <thead>
                   <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                     <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Order #</th>
                     <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Status</th>
                     <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Priority</th>
                     <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Qty (m)</th>
                     <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Due Date</th>
                     <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Action</th>
                   </tr>
                 </thead>
                 <tbody>
                   {workOrders.map(wo => (
                     <tr key={wo.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: wo.isUrgent ? 'rgba(225, 29, 72, 0.1)' : 'transparent', borderLeft: wo.isUrgent ? '3px solid #e11d48' : 'none' }}>
                       <td style={{ padding: '12px 8px', color: 'var(--accent-cyan)' }}>{wo.id}</td>
                       <td style={{ padding: '12px 8px' }}>
                         {wo.materialStatus === 'Pending' ? <span style={{ color: 'orange', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={14}/> Pending</span> : <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={14}/> Cleared</span>}
                       </td>
                       <td style={{ padding: '12px 8px' }}>{wo.priorityNumber || '-'}</td>
                       <td style={{ padding: '12px 8px', fontWeight: 600 }}>{wo.qty.toLocaleString()}</td>
                       <td style={{ padding: '12px 8px' }}>{new Date(wo.dueDate).toLocaleDateString()}</td>
                       <td style={{ padding: '12px 8px' }}>
                         <button onClick={() => handleDeleteWorkOrder(wo.id)} style={deleteBtnStyle} title="Delete Job"><Trash2 size={16} /></button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
             
             <div className="glass-panel" style={{ width: '420px', padding: '24px', height: 'fit-content', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0 }}>Punch Work Order</h3>
                  <div>
                    <input type="file" id="bulkUpload" accept=".xlsx, .xls" style={{ display: 'none' }} onChange={handleFileUpload} />
                    <label htmlFor="bulkUpload" style={{...btnStyle, background: '#10b981', color: 'white', display: 'inline-block', cursor: 'pointer', padding: '6px 12px', fontSize: '0.8rem'}}>Bulk Excel Upload</label>
                  </div>
                </div>

               <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Work Order # (e.g. WO-TATA)</label>
                    <input value={newWO.id} onChange={e=>setNewWO({...newWO, id: e.target.value})} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Cable Properties (e.g. 5x2.5mm)</label>
                    <input value={newWO.cableDetails} onChange={e=>setNewWO({...newWO, cableDetails: e.target.value})} style={inputStyle} />
                  </div>
                 
                 <div style={{ display: 'flex', gap: '12px' }}>
                   <div style={{ flex: 1 }}>
                     <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Map Path</label>
                     <select value={newWO.routingId} onChange={e=>setNewWO({...newWO, routingId: e.target.value})} style={inputStyle}>
                       <option value="">-- Master Paths --</option>
                       {routings.map(r => <option key={r.id} value={r.id}>{r.id}</option>)}
                     </select>
                   </div>
                   <div style={{ flex: 1 }}>
                     <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Material State</label>
                     <select value={newWO.materialStatus} onChange={e=>setNewWO({...newWO, materialStatus: e.target.value as 'Available'|'Pending'})} style={inputStyle}>
                       <option value="Available">Available (Ready)</option>
                       <option value="Pending">Pending Drop</option>
                     </select>
                   </div>
                 </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Target Quantity (Meters)</label>
                    <input type="number" value={newWO.qty || ''} onChange={e=>setNewWO({...newWO, qty: Number(e.target.value)})} style={inputStyle} />
                  </div>

                 <div style={{ display: 'flex', gap: '12px' }}>
                   <div style={{ flex: 1 }}>
                     <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Start Strategy Date</label>
                     <input type="date" value={newWO.startDate} onChange={e=>setNewWO({...newWO, startDate: e.target.value})} style={inputStyle} />
                   </div>
                   <div style={{ flex: 1 }}>
                     <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Delivery Deadline</label>
                     <input type="date" value={newWO.dueDate} onChange={e=>setNewWO({...newWO, dueDate: e.target.value})} style={inputStyle} />
                   </div>
                 </div>

                 <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Priority Number (Optional)</label>
                    <input type="number" placeholder="e.g. 1" value={newWO.priorityNumber || ''} onChange={e=>setNewWO({...newWO, priorityNumber: Number(e.target.value)})} style={inputStyle} />
                 </div>

                 <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                   <input type="checkbox" checked={newWO.isUrgent} onChange={e=>setNewWO({...newWO, isUrgent: e.target.checked})} style={{ width: '16px', height: '16px' }} />
                   <Zap size={16} color={newWO.isUrgent ? '#e11d48' : 'var(--text-secondary)'} />
                   <span>Prioritize as Urgent</span>
                 </label>

                 <button onClick={handleAddWorkOrder} style={btnStyle}><PlusCircle size={16}/> Push Work Order</button>
               </div>
             </div>
           </div>
        )}

        {/* 6. SYSTEM OVERVIEW */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '960px' }}>

            <div className="glass-panel" style={{ padding: '32px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '250px', height: '250px', background: 'var(--accent-cyan)', filter: 'blur(120px)', opacity: 0.08, borderRadius: '50%' }}></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                <div style={{ background: 'var(--accent-blue)', padding: '12px', borderRadius: '12px', boxShadow: '0 0 20px rgba(0,102,255,0.3)' }}><Layers size={28} color="white"/></div>
                <div>
                  <h1 style={{ margin: 0, fontSize: '1.8rem' }}>OpCenter <span style={{ color: 'var(--accent-cyan)' }}>Cable</span> APS</h1>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Advanced Planning and Scheduling Platform — v2.0.0</span>
                </div>
              </div>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '0.95rem', margin: 0 }}>
                OpCenter Cable is a purpose-built <strong style={{ color: 'white' }}>Advanced Planning and Scheduling (APS)</strong> system designed specifically for cable manufacturing operations. It bridges the gap between raw work orders and actual shop floor execution by modeling machine constraints, production routing sequences, material availability, and delivery urgency — all within a single real-time planning interface. No backend server or database is required; everything runs directly in your browser.
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '28px' }}>
              <h2 style={{ marginTop: 0, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '10px' }}><Zap size={20}/> Why This Exists</h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                Cable manufacturing involves complex, multi-stage production paths — from conductor stranding through insulation extrusion, laying-up, inner sheathing, armouring, and outer sheathing. Each stage depends on a specific machine or machine cluster, and a delay or bottleneck at any step cascades through downstream deliveries. Traditional spreadsheets and generic ERPs cannot dynamically re-sequence jobs when urgent orders appear mid-shift or when material drops are delayed. OpCenter Cable was built to solve this problem precisely — providing a visual, rules-driven planning engine that cable production planners can configure and run in seconds.
              </p>
            </div>

            <h2 style={{ margin: '4px 0', color: 'white' }}>Modules at a Glance</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {[
                { icon: <BarChart3 size={20} color="#00d2ff"/>, title: 'Global Dashboard', color: '#00d2ff', desc: 'A live command-centre showing total queued metreage, count of pending material orders, and urgent jobs at a glance. Machine capacity utilization is shown as live bar charts updated after each schedule execution.' },
                { icon: <CalendarDays size={20} color="#0066ff"/>, title: 'Execution Gantt', color: '#0066ff', desc: 'A machine-row Gantt chart with a scaled timeline X-axis (Day 0 to Day 10). Jobs are rendered as colored blocks. Hover any block to see a detailed floating tooltip including operation, machine, duration, exact timestamps, and constraint flags.' },
                { icon: <ClipboardList size={20} color="#10b981"/>, title: 'Work Orders', color: '#10b981', desc: 'Create production jobs by specifying the cable spec, routing path, target meters, start/deadline dates, priority number, and urgent flag. Supports single-record entry or bulk import via structured Excel files.' },
                { icon: <Route size={20} color="#f59e0b"/>, title: 'Routing Masters', color: '#f59e0b', desc: 'Define sequential multi-machine production paths per cable type using an SAP-styled tabular form. Capture cable-level specs (type, cores, conductor size), then build each operation step by assigning a machine or resource group and setting optional post-op wait times.' },
                { icon: <Database size={20} color="#a78bfa"/>, title: 'Machine Database', color: '#a78bfa', desc: 'Maintain the full asset registry. Each machine has an ID, name, optional resource group assignment, and a maximum throughput capacity in meters per run. The scheduler uses these records to map routing steps to physical assets.' },
                { icon: <Layers size={20} color="#fb923c"/>, title: 'Resource Groups', color: '#fb923c', desc: 'Cluster equivalent machines into logical groups (e.g. Extrusion Lines). When a routing step points to a group, the scheduler auto-selects the group member with the earliest availability — enabling real load balancing across parallel machines.' }
              ].map(mod => (
                <div key={mod.title} className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ background: `${mod.color}22`, padding: '8px', borderRadius: '8px', border: `1px solid ${mod.color}44` }}>{mod.icon}</div>
                    <h3 style={{ margin: 0, color: mod.color, fontSize: '0.95rem' }}>{mod.title}</h3>
                  </div>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.85rem' }}>{mod.desc}</p>
                </div>
              ))}
            </div>

            <div className="glass-panel" style={{ padding: '28px' }}>
              <h2 style={{ marginTop: 0, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '10px' }}><Activity size={20}/> Step-by-Step Workflow</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  { step: '01', title: 'Set Up Your Shop Floor — Machine Database + Resource Groups', detail: 'Start by registering every machine in the Machine Database with a unique ID, name, and max capacity. Then create Resource Groups to cluster equivalent machines (e.g. three extruders into one group). This lets the scheduler load-balance automatically.' },
                  { step: '02', title: 'Define Routing Paths — Routing Masters', detail: 'Build a routing path for each product or cable family. Use the SAP-style table to add operation steps in sequence, assigning a machine or a group to each step. Set post-op cooling/wait times where applicable (e.g. 120 minutes after insulation before laying-up).' },
                  { step: '03', title: 'Create or Import Work Orders', detail: 'Add orders manually via the Punch Work Order form, or upload a structured Excel file. Each order references a routing path, specifies target quantity in meters, has start and delivery dates, a priority number, and can be flagged Urgent to jump the queue.' },
                  { step: '04', title: 'Sync Material Availability', detail: 'Click "Simulate ERP Sync" in the top bar to confirm all pending material drops as Available. This mimics ERP stock confirmation, releasing blocked orders for scheduling.' },
                  { step: '05', title: 'Configure Rules and Execute the Schedule', detail: 'In Execution Gantt, pick your scheduling direction (Forward from today, or Backward from delivery deadlines) and the sort rule (Earliest Due Date, Priority Number, or Max Quantity First). Click Execute Schedule. The engine sorts orders, sequences them across machines, resolves group assignments, and renders the full Gantt chart.' },
                  { step: '06', title: 'Inspect the Gantt Chart — Hover Tooltips', detail: 'Each job block on the Gantt displays the work order ID abbreviation. Hover over any block to reveal a floating card showing: Work Order ID, cable details, operation name, assigned machine ID, total duration in minutes, start and end timestamps, and any active constraint flags (Urgent / Wait Bottleneck).' }
                ].map(w => (
                  <div key={w.step} style={{ display: 'flex', gap: '16px', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', borderLeft: '3px solid var(--accent-blue)' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--accent-blue)', opacity: 0.4, flexShrink: 0, lineHeight: 1, minWidth: '36px' }}>{w.step}</div>
                    <div>
                      <h4 style={{ margin: '0 0 6px 0', color: 'white', fontSize: '0.9rem' }}>{w.title}</h4>
                      <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.85rem' }}>{w.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '28px' }}>
              <h2 style={{ marginTop: 0, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '10px' }}><Database size={20}/> Excel Bulk Upload — Column Schema</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>Your .xlsx file must have the following column headers in Row 1. Data starts from Row 2 onwards.</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,102,255,0.12)' }}>
                    <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid var(--border-glass)', color: 'var(--accent-blue)' }}>Column Header</th>
                    <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid var(--border-glass)', color: 'var(--accent-blue)' }}>Type</th>
                    <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid var(--border-glass)', color: 'var(--accent-blue)' }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Work Order #', 'Text', 'Unique work order identifier (e.g. WO-BHEL-001)'],
                    ['Cable Properties', 'Text', 'Cable spec description (e.g. 3C x 95 sq.mm Armoured)'],
                    ['Map Path', 'Text', 'Routing Master ID to link to a production path (e.g. PATH-001)'],
                    ['Target Quantity (Meters)', 'Number', 'Production quantity in linear meters'],
                    ['Start Strategy Date', 'Date', 'Planned shop-floor start date'],
                    ['Delivery Deadline', 'Date', 'Customer delivery / project completion date'],
                    ['Material State', 'Text', 'Available or Pending — whether raw materials are confirmed ready'],
                    ['Prioritize as Urgent', 'Text', 'Yes / TRUE — flags this order to jump ahead of non-urgent queue'],
                    ['Priority Number', 'Number', 'Numeric rank; lower = higher priority. Used by the Priority rule in the scheduler.']
                  ].map(([col, type, desc]) => (
                    <tr key={col} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '10px', color: 'var(--accent-cyan)', fontFamily: 'monospace', fontSize: '0.8rem' }}>{col}</td>
                      <td style={{ padding: '10px', color: '#a78bfa' }}>{type}</td>
                      <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="glass-panel" style={{ padding: '24px', borderLeft: '3px solid #10b981' }}>
              <h3 style={{ marginTop: 0, color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 size={18}/> Data Persistence</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0, fontSize: '0.9rem' }}>
                All data — machines, resource groups, routing masters, and work orders — is persisted automatically in your browser's <strong style={{ color: 'white' }}>localStorage</strong>. You do not need a server or database. Your configurations survive page refreshes and browser restarts as long as you use the same browser profile on the same machine. To fully reset the application, clear site data for this page from your browser settings.
              </p>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
