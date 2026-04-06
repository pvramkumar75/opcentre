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
  bottleneckReason?: string;
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
  // Zoom state for Gantt chart
  const [ganttZoom, setGanttZoom] = useState(1);
  // Store hovered job and mouse position for floating label
  const [hoveredJob, setHoveredJob] = useState<{ job: GlobalScheduleStep, mouseX: number, mouseY: number } | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  // View mode for scheduling visualization
  const [scheduleViewMode, setScheduleViewMode] = useState<'gantt' | 'spreadsheet' | 'calendar'>('gantt');
  const [calendarAnchorDate, setCalendarAnchorDate] = useState(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  });

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
    e.target.value = ''; // allow re-upload of same file
    const reader = new FileReader();
    reader.onload = (evt) => {
        const bstr = evt.target?.result as string;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: false });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) as any[][];

        // --- Find header row: look for the row that has "Cable Properties" ---
        const headerRowIndex = rawRows.findIndex(row =>
            row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('cable properties'))
        );
        if (headerRowIndex === -1) {
            alert('Could not find a header row with "Cable Properties" in your Excel file.');
            return;
        }

        const headers: string[] = rawRows[headerRowIndex].map((h: any) => String(h || '').trim());
        const dataRows = rawRows.slice(headerRowIndex + 1);

        // Helper: find column value by partial header keyword match
        const getCol = (row: any[], ...keys: string[]): any => {
            for (const key of keys) {
                const idx = headers.findIndex(h => h.toLowerCase().includes(key.toLowerCase()));
                if (idx !== -1 && row[idx] !== undefined && row[idx] !== null && row[idx] !== '') return row[idx];
            }
            return undefined;
        };

        // Convert Excel serial number OR date strings (DD/MM/YYYY) to ISO date string
        const toISODate = (val: any): string => {
            if (!val) return new Date().toISOString().split('T')[0];
            if (typeof val === 'number') {
                // Excel serial date (days since 1900-01-01, fixing Excel's leap-year bug)
                const d = new Date(Math.round((val - 25569) * 86400 * 1000));
                return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0];
            }
            const s = String(val).trim();
            // Try DD/MM/YYYY
            const ddmm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (ddmm) {
                const d = new Date(`${ddmm[3]}-${ddmm[2].padStart(2,'0')}-${ddmm[1].padStart(2,'0')}`);
                return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0];
            }
            const d = new Date(s);
            return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0];
        };

        // Normalise material status: Available (Ready) / Cleared → Available; everything else → Pending
        const toStatus = (val: any): 'Available' | 'Pending' => {
            const v = String(val || '').toLowerCase().trim();
            if (v.includes('available') || v.includes('ready') || v.includes('cleared')) return 'Available';
            return 'Pending';
        };

        // Detect urgent: YES → true, NO / blank → false
        const toUrgent = (val: any): boolean => {
            const v = String(val || '').toLowerCase().trim();
            return v === 'yes' || v === 'true' || v === '1';
        };

        let autoIdx = 1;
        const newOrders: WorkOrder[] = [];

        dataRows.forEach((row: any[]) => {
            // Skip rows with no cable properties OR zero quantity
            const cable = getCol(row, 'cable properties', 'cable prop');
            const qty   = getCol(row, 'target qty', 'quantity');
            if (!cable || !String(cable).trim()) return;
            if (!qty || Number(qty) <= 0) return;

            // Skip summary / label rows (first-cell text that is clearly a label)
            const firstCell = String(row[0] || '').trim();
            if (firstCell.endsWith(':') || ['summary', 'total', 'instructions'].some(kw => firstCell.toLowerCase().startsWith(kw))) return;

            // Auto-generate WO ID: check if a "Work Order #" column exists, otherwise generate
            const rawId = getCol(row, 'work order');
            const woId  = rawId ? String(rawId).trim() : `WO-IMP-${String(autoIdx++).padStart(3, '0')}`;

            // "Status" column maps to materialStatus; "Material State" is the dropdown source
            const matState = getCol(row, 'status') || getCol(row, 'material state', 'material');

            // Fuzzy find Routing ID if user provided a Name in Excel
            const rawPathVal = String(getCol(row, 'map path', 'routing', 'path') || '').trim();
            let finalRoutingId = rawPathVal;
            const routeMatch = routings.find(r => 
                r.id.toLowerCase() === rawPathVal.toLowerCase() || 
                r.name.toLowerCase() === rawPathVal.toLowerCase()
            );
            if (routeMatch) finalRoutingId = routeMatch.id;

            newOrders.push({
                id: woId,
                cableDetails: String(cable).trim(),
                routingId: finalRoutingId,
                qty: Number(qty),
                startDate: toISODate(getCol(row, 'start strategy', 'start date', 'start')),
                dueDate:   toISODate(getCol(row, 'delivery deadline', 'delivery', 'due')),
                isUrgent:  toUrgent(getCol(row, 'prioritize', 'urgent')),
                materialStatus: toStatus(matState),
                priorityNumber: Number(getCol(row, 'priority number', 'priority')) || 999
            });
        });

        if (newOrders.length === 0) {
            alert('No valid rows found. Make sure rows have Cable Properties filled and Target Qty > 0.');
            return;
        }
        setWorkOrders(prev => [...prev, ...newOrders]);
        alert(`✅ Successfully imported ${newOrders.length} work order(s).`);
    };
    reader.readAsBinaryString(file);
  };


  const executeSchedule = () => {
    const sortedWOs = [...workOrders].filter(wo => wo.materialStatus !== 'Pending');
    sortedWOs.sort((a, b) => {
        if (a.isUrgent && !b.isUrgent) return -1;
        if (!a.isUrgent && b.isUrgent) return 1;
        if (schedConfig.sortRule === 'MaxQuantity') return b.qty - a.qty;
        if (schedConfig.sortRule === 'Priority') return (a.priorityNumber || 999) - (b.priorityNumber || 999);
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(); // default DueDate
    });

    const machAvail: Record<string, number> = {};
    const jobs: GlobalScheduleStep[] = [];

    const DEFAULT_SPEED = 100;
    const DEFAULT_SETUP = 60;
    
    const baseDate = new Date();
    baseDate.setHours(8, 0, 0, 0); 
    const baseTime = baseDate.getTime(); 

    sortedWOs.forEach(wo => {
      // Find route: try exact ID, then Name (case-insensitive)
      const route = routings.find(r => 
        r.id.toLowerCase() === wo.routingId.toLowerCase() || 
        r.name.toLowerCase() === wo.routingId.toLowerCase()
      );
      if (!route) return;
        
      let pathTime = baseTime;
      const woStart = new Date(wo.startDate).getTime();
      if (woStart > pathTime) pathTime = woStart;
        
      const backwardBase = new Date(wo.dueDate).getTime();
        
      const stepJobs: GlobalScheduleStep[] = [];
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
            const dur = (wo.qty / DEFAULT_SPEED) + DEFAULT_SETUP;
            const end = backwardCursor;
            const start = end - dur * 60000;
            const selectedMach = assignMachine(s.machineId);
                
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
            const dur = (wo.qty / DEFAULT_SPEED) + DEFAULT_SETUP;
            const selectedMach = assignMachine(s.machineId);
            const machReady = machAvail[selectedMach] || baseTime;
            const isBottleneck = pathTime < machReady;
            const actualStart = Math.max(pathTime, machReady);
            const actualEnd = actualStart + dur * 60000;
            const bottleneckReason = isBottleneck
              ? `Machine ${selectedMach} busy until ${new Date(machReady).toLocaleDateString()} ${new Date(machReady).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : '';
                
            jobs.push({
              workOrderId: wo.id, cableDetails: wo.cableDetails, machineId: selectedMach, operation: s.operation,
              isUrgent: wo.isUrgent, isBottleneck, bottleneckReason, totalDurMins: dur,
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
  const ganttPixelWidth = Math.max(1200, (totalGanttDurMs / 86400000) * 220 * ganttZoom);
  const ganttTicks = useMemo(() => {
    const duration = maxGanttTime - minGanttTime;
    if (duration <= 0) return [];
    const points = 7;
    return Array.from({ length: points }, (_, idx) => {
      const time = new Date(minGanttTime + Math.round(duration * (idx / (points - 1))));
      return { time, left: `${(idx / (points - 1)) * 100}%` };
    });
  }, [minGanttTime, maxGanttTime]);

  const currentDateLeft = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (today.getTime() < minGanttTime || today.getTime() > maxGanttTime) return null;
    return ((today.getTime() - minGanttTime) / totalGanttDurMs) * 100 * ganttZoom;
  }, [minGanttTime, maxGanttTime, totalGanttDurMs, ganttZoom]);

  const selectedOrderJobs = useMemo(() => {
    if (!selectedOrderId) return [];
    return scheduledGanttData
      .filter(step => step.workOrderId === selectedOrderId)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [selectedOrderId, scheduledGanttData]);

  const ganttRowHeight = 50;
  const ganttRowGap = 16;

  const orderLinkages = useMemo(() => {
    if (!selectedOrderJobs.length) return [];
    return selectedOrderJobs.slice(0, -1).map((current, idx) => {
      const next = selectedOrderJobs[idx + 1];
      const sourceMachineIndex = machines.findIndex(m => m.id === current.machineId);
      const targetMachineIndex = machines.findIndex(m => m.id === next.machineId);
      if (sourceMachineIndex === -1 || targetMachineIndex === -1) return null;

      const sourceLeft = ((current.startDate.getTime() - minGanttTime) / totalGanttDurMs) * 100 * ganttZoom;
      const sourceWidth = ((current.endDate.getTime() - current.startDate.getTime()) / totalGanttDurMs) * 100 * ganttZoom;
      const targetLeft = ((next.startDate.getTime() - minGanttTime) / totalGanttDurMs) * 100 * ganttZoom;

      return {
        key: `${current.workOrderId}-${idx}`,
        left: sourceLeft + sourceWidth,
        right: targetLeft,
        top: sourceMachineIndex * (ganttRowHeight + ganttRowGap) + ganttRowHeight / 2,
        bottom: targetMachineIndex * (ganttRowHeight + ganttRowGap) + ganttRowHeight / 2,
      };
    }).filter(Boolean) as Array<{ key: string; left: number; right: number; top: number; bottom: number; }>;
  }, [selectedOrderJobs, machines, minGanttTime, totalGanttDurMs, ganttZoom]);

  const isoDay = (date: Date) => date.toISOString().split('T')[0];
  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(calendarAnchorDate);
      day.setDate(day.getDate() + i);
      days.push(day);
    }
    return days;
  }, [calendarAnchorDate]);

  const jobsByDay = useMemo(() => {
    const buckets: Record<string, GlobalScheduleStep[]> = {};
    scheduledGanttData.forEach(job => {
      const key = isoDay(job.startDate);
      buckets[key] = buckets[key] || [];
      buckets[key].push(job);
    });
    return buckets;
  }, [scheduledGanttData]);

  const getDelayDaysFromDue = (endDate: Date, dueDate: string): number => {
    const due = new Date(dueDate);
    due.setHours(23, 59, 59, 999);
    return Math.ceil((endDate.getTime() - due.getTime()) / 86400000);
  };

  const getDelayDaysLate = (endDate: Date, dueDate: string): number => {
    return Math.max(0, getDelayDaysFromDue(endDate, dueDate));
  };

  const scheduleWorkOrderSummary = useMemo(() => {
    const grouped = new Map<string, GlobalScheduleStep[]>();
    scheduledGanttData.forEach(step => {
      const items = grouped.get(step.workOrderId) || [];
      items.push(step);
      grouped.set(step.workOrderId, items);
    });

    return Array.from(grouped.entries()).map(([id, steps]) => {
      const workOrder = workOrders.find(w => w.id === id);
      const completionMs = Math.max(...steps.map(step => step.endDate.getTime()));
      const completion = new Date(completionMs);
      const due = workOrder ? new Date(workOrder.dueDate) : completion;
      due.setHours(23, 59, 59, 999);
      const slackMins = (due.getTime() - completion.getTime()) / 60000;
      const delayDays = getDelayDaysLate(completion, workOrder?.dueDate || completion.toISOString());
      const status = completion.getTime() > due.getTime()
        ? 'Late'
        : slackMins <= 8 * 60
          ? 'At Risk'
          : 'On Track';

      return {
        workOrderId: id,
        completion,
        due,
        slackMins,
        delayDays,
        status,
        steps: steps.length
      };
    });
  }, [scheduledGanttData, workOrders]);

  const lateWorkOrders = scheduleWorkOrderSummary.filter(item => item.status === 'Late').length;
  const atRiskWorkOrders = scheduleWorkOrderSummary.filter(item => item.status === 'At Risk').length;
  const onTrackWorkOrders = scheduleWorkOrderSummary.filter(item => item.status === 'On Track').length;
  const totalSlackHours = Math.max(0, scheduleWorkOrderSummary.reduce((sum, item) => sum + Math.max(item.slackMins, 0), 0) / 60).toFixed(1);

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
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => setScheduleViewMode('gantt')} 
                      style={{
                        ...btnStyle, 
                        background: scheduleViewMode === 'gantt' ? 'var(--accent-blue)' : 'rgba(255,255,255,0.1)',
                        padding: '8px 16px',
                        fontSize: '0.85rem'
                      }}
                    >
                      <BarChart3 size={16} style={{ marginRight: '6px' }} />
                      Gantt View
                    </button>
                    <button 
                      onClick={() => setScheduleViewMode('spreadsheet')} 
                      style={{
                        ...btnStyle, 
                        background: scheduleViewMode === 'spreadsheet' ? 'var(--accent-blue)' : 'rgba(255,255,255,0.1)',
                        padding: '8px 16px',
                        fontSize: '0.85rem'
                      }}
                    >
                      <Database size={16} style={{ marginRight: '6px' }} />
                      Spreadsheet View
                    </button>
                    <button 
                      onClick={() => setScheduleViewMode('calendar')} 
                      style={{
                        ...btnStyle, 
                        background: scheduleViewMode === 'calendar' ? 'var(--accent-blue)' : 'rgba(255,255,255,0.1)',
                        padding: '8px 16px',
                        fontSize: '0.85rem'
                      }}
                    >
                      <CalendarDays size={16} style={{ marginRight: '6px' }} />
                      Calendar View
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '12px', background: 'var(--accent-blue)', borderRadius: '2px' }}></div><span style={{ fontSize: '0.85rem' }}>Normal Run</span></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '12px', background: '#e11d48', borderRadius: '2px' }}></div><span style={{ fontSize: '0.85rem' }}>Urgent Overwrite</span></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '12px', border: '2px dashed orange', borderRadius: '2px' }}></div><span style={{ fontSize: '0.85rem' }}>Wait Constraint</span></div>
                  </div>
                </div>
              </div>

              {scheduledGanttData.length > 0 && (lateWorkOrders > 0 || atRiskWorkOrders > 0) && (
                <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(254,215,170,0.16)', border: '1px solid rgba(251,146,60,0.3)', borderRadius: '12px', color: '#c2410c', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
                  <strong style={{ fontSize: '0.95rem' }}>Schedule Warning:</strong>
                  {lateWorkOrders > 0 && <span>{lateWorkOrders} late work order{lateWorkOrders === 1 ? '' : 's'} detected.</span>}
                  {atRiskWorkOrders > 0 && <span>{atRiskWorkOrders} at-risk work order{atRiskWorkOrders === 1 ? '' : 's'} detected.</span>}
                  <span style={{ marginLeft: 'auto', color: '#c2410c', fontWeight: 600 }}>Review priority, resource capacity, or due date targets.</span>
                </div>
              )}

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

              {scheduledGanttData.length === 0 && <div style={{textAlign: 'center', padding: '40px', color: 'var(--text-secondary)'}}>Click 'Execute Schedule' to build the schedule view.</div>}

              {scheduledGanttData.length > 0 && (
                <div className="glass-panel" style={{ padding: '18px 20px 20px', marginBottom: '24px', background: 'rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                    <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(0,102,255,0.08)', border: '1px solid rgba(0,102,255,0.18)' }}>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Late Work Orders</div>
                      <div style={{ fontSize: '1.7rem', fontWeight: 700, color: '#ef4444' }}>{lateWorkOrders}</div>
                    </div>
                    <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.18)' }}>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>At-Risk Work Orders</div>
                      <div style={{ fontSize: '1.7rem', fontWeight: 700, color: '#f59e0b' }}>{atRiskWorkOrders}</div>
                    </div>
                    <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)' }}>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>On Track Work Orders</div>
                      <div style={{ fontSize: '1.7rem', fontWeight: 700, color: '#10b981' }}>{onTrackWorkOrders}</div>
                    </div>
                    <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)' }}>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Total Slack Available</div>
                      <div style={{ fontSize: '1.7rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>{totalSlackHours} hrs</div>
                    </div>
                  </div>
                </div>
              )}

              {scheduledGanttData.length > 0 && scheduleViewMode === 'gantt' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', background: 'rgba(0,102,255,0.05)' }}>
                    <h3 style={{ marginBottom: '12px', fontSize: '1rem', color: 'var(--accent-cyan)' }}>Schedule Summary (Estimated Completion)</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                      {Array.from(new Set(scheduledGanttData.map(s => s.workOrderId))).map(woId => {
                        const woJobs = scheduledGanttData.filter(j => j.workOrderId === woId);
                        const completionDate = new Date(Math.max(...woJobs.map(j => j.endDate.getTime())));
                        const wo = workOrders.find(w => w.id === woId);
                        const isLate = wo ? completionDate.getTime() > new Date(wo.dueDate).getTime() + 86400000 : false;
                        const isSelected = selectedOrderId === woId;
                        
                        return (
                          <div
                            key={woId}
                            onClick={() => setSelectedOrderId(prev => prev === woId ? null : woId)}
                            style={{
                              background: isSelected ? 'rgba(0,210,255,0.1)' : 'rgba(255,255,255,0.03)',
                              padding: '12px',
                              borderRadius: '8px',
                              border: isSelected ? '1px solid rgba(0,210,255,0.45)' : '1px solid var(--border-glass)',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: isSelected ? '0 0 0 2px rgba(0,210,255,0.12)' : 'none'
                            }}
                          >
                             <div style={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                               <span>{woId}</span>
                               {isLate && <span style={{ color: '#ef4444', fontSize: '0.7rem', border: '1px solid #ef4444', padding: '1px 4px', borderRadius: '3px' }}>DELAY RISK</span>}
                             </div>
                             <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                               Est. Finish: <strong style={{ color: isLate ? '#ef4444' : '#10b981' }}>{completionDate.toLocaleDateString()} {completionDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</strong>
                             </div>
                             {wo && (
                               <>
                                 <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                                   Promised Due: {new Date(wo.dueDate).toLocaleDateString()}
                                 </div>
                                 {(() => {
                                   const delayDays = getDelayDaysFromDue(completionDate, wo.dueDate);
                                   return (
                                     <div style={{ fontSize: '0.7rem', color: delayDays > 0 ? '#f59e0b' : '#10b981', marginTop: '4px' }}>
                                       {delayDays > 0 ? `Delay +${delayDays} day${delayDays === 1 ? '' : 's'}` : delayDays < 0 ? `Early ${Math.abs(delayDays)} day${Math.abs(delayDays) === 1 ? '' : 's'}` : 'On time'}
                                     </div>
                                   );
                                 })()}
                               </>
                             )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Timeline X-Axis */}
                <div style={{ position: 'relative', minWidth: `${ganttPixelWidth}px`, paddingLeft: '220px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', padding: '0 6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {ganttTicks.map((tick, i) => (
                        <div key={i} style={{ position: 'absolute', left: tick.left, transform: 'translateX(-50%)', textAlign: 'center', minWidth: '80px' }}>
                          <div style={{ fontWeight: 600 }}>{tick.time.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)' }}>{tick.time.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                        </div>
                      ))}
                      <div style={{ position: 'absolute', top: '40px', left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                    </div>
                    {currentDateLeft !== null && (
                      <div style={{ position: 'absolute', left: `${currentDateLeft}%`, top: 0, bottom: 0, width: '2px', background: 'rgba(96,165,250,0.85)', opacity: 0.65 }} />
                    )}
                </div>

                <div style={{ position: 'relative', minWidth: `${ganttPixelWidth}px` }} onClick={() => setSelectedOrderId(null)}>
                  {selectedOrderId && orderLinkages.length > 0 && (
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                      {orderLinkages.map(link => {
                        const height = Math.abs(link.bottom - link.top);
                        const sourceY = link.top <= link.bottom ? 0 : height;
                        const targetY = link.top <= link.bottom ? height : 0;
                        return (
                          <div key={link.key} style={{ position: 'absolute', top: Math.min(link.top, link.bottom), left: `${link.left}%`, width: `${Math.max(link.right - link.left, 0)}%`, height: `${height}px`, overflow: 'visible' }}>
                            <div style={{ position: 'absolute', top: `${sourceY}px`, left: 0, width: '100%', height: '2px', background: '#facc15' }} />
                            <div style={{ position: 'absolute', left: '100%', top: `${Math.min(sourceY, targetY)}px`, width: '2px', height: `${Math.abs(targetY - sourceY)}px`, background: '#facc15' }} />
                            <div style={{ position: 'absolute', top: `${targetY - 5}px`, left: '100%', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: targetY > sourceY ? '6px solid #facc15' : undefined, borderBottom: targetY < sourceY ? '6px solid #facc15' : undefined }} />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowX: 'auto', paddingBottom: '20px' }}>
                    {machines.map((m, rowIndex) => {
                      const machineJobs = scheduledGanttData.filter(s => s.machineId === m.id);
                      const rowBackground = rowIndex % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.03)';
                      const rowHasSelected = selectedOrderJobs.some(job => job.machineId === m.id);
                      return (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', position: 'relative', borderRadius: '14px', background: rowBackground, padding: '12px 0', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)' }}>
                          <div style={{ width: '220px', flexShrink: 0, paddingRight: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                             <h4 style={{ margin: 0, fontSize: '0.95rem', color: rowHasSelected ? 'white' : 'rgba(255,255,255,0.9)', letterSpacing: '0.01em' }}>{m.name}</h4>
                             <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)' }}>{m.id}</span>
                          </div>
                          <div style={{ flex: 1, minHeight: `${ganttRowHeight}px`, position: 'relative', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', overflow: 'hidden', border: rowHasSelected ? '1px solid rgba(56,189,248,0.25)' : '1px solid rgba(255,255,255,0.08)' }}>
                            {ganttTicks.map((tick, idx) => (
                              <div key={idx} style={{ position: 'absolute', top: 0, bottom: 0, left: tick.left, width: '1px', background: idx % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)' }} />
                            ))}
                            {machineJobs.map((job, idx) => {
                               const leftPct = ((job.startDate.getTime() - minGanttTime) / totalGanttDurMs) * 100 * ganttZoom;
                               const widthPct = ((job.endDate.getTime() - job.startDate.getTime()) / totalGanttDurMs) * 100 * ganttZoom;
                               const isSelected = selectedOrderId === job.workOrderId;
                               const notSelected = selectedOrderId && selectedOrderId !== job.workOrderId;
                               return (
                                 <div
                                   key={idx}
                                   onClick={e => { e.stopPropagation(); setSelectedOrderId(job.workOrderId); }}
                                   onMouseEnter={e => {
                                     setHoveredJob({ job, mouseX: e.clientX, mouseY: e.clientY });
                                   }}
                                   onMouseMove={e => {
                                     setHoveredJob({ job, mouseX: e.clientX, mouseY: e.clientY });
                                   }}
                                   onMouseLeave={() => setHoveredJob(null)}
                                   style={{
                                     position: 'absolute',
                                     left: `${leftPct}%`,
                                     width: `${Math.max(widthPct, 2)}%`,
                                     height: '72%',
                                     top: '14%',
                                     background: job.isUrgent ? 'linear-gradient(135deg, #f97316, #ef4444)' : 'linear-gradient(135deg, #2563eb, #0ea5e9)',
                                     borderRadius: '10px',
                                     border: isSelected ? '2px solid rgba(96,165,250,0.9)' : job.isBottleneck ? '2px dashed rgba(251,146,60,0.8)' : '1px solid rgba(255,255,255,0.12)',
                                     opacity: notSelected ? 0.35 : 1,
                                     boxShadow: isSelected ? '0 0 0 4px rgba(96,165,250,0.22)' : '0 8px 20px rgba(0,0,0,0.18)',
                                     display: 'flex',
                                     alignItems: 'center',
                                     justifyContent: 'center',
                                     fontSize: '0.72rem',
                                     fontWeight: 600,
                                     color: 'white',
                                     overflow: 'hidden',
                                     whiteSpace: 'nowrap',
                                     textOverflow: 'ellipsis',
                                     padding: '0 8px',
                                     zIndex: isSelected ? 14 : 12,
                                     cursor: 'pointer',
                                     transition: 'transform 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease',
                                     transform: isSelected ? 'scale(1.02)' : 'none'
                                   }}
                                 >
                                   {job.workOrderId} · {job.operation}
                                 </div>
                               );
                             })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>


              {/* Gantt Zoom Slider */}
              <div style={{ margin: '0 0 16px 220px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Zoom:</label>
                <input type="range" min="0.5" max="2.5" step="0.05" value={ganttZoom} onChange={e => setGanttZoom(Number(e.target.value))} style={{ width: 180 }} />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{(ganttZoom * 100).toFixed(0)}%</span>
              </div>

              {/* Floating label above cursor, follows mouse (only in Gantt tab) */}
              {activeTab === 'gantt' && hoveredJob && (
                <div style={{
                  position: 'fixed',
                  left: Math.min(window.innerWidth - 340, hoveredJob.mouseX + 16),
                  top: Math.max(80, hoveredJob.mouseY - 60),
                  width: 320,
                  minHeight: 120,
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-glass)',
                  padding: '18px',
                  borderRadius: '12px',
                  zIndex: 9999,
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                  color: 'white',
                  pointerEvents: 'none',
                  fontSize: '0.9rem',
                  transition: 'opacity 0.2s',
                }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '8px', color: 'var(--accent-cyan)' }}>{hoveredJob.job.workOrderId}</div>
                  <div style={{ marginBottom: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{hoveredJob.job.cableDetails}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'min-content 1fr', gap: '4px 12px' }}>
                    <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Operation:</span> <span>{hoveredJob.job.operation}</span>
                    <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Asset ID:</span> <span>{hoveredJob.job.machineId}</span>
                    <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Duration:</span> <span>{hoveredJob.job.totalDurMins.toFixed(0)} mins</span>
                  </div>
                  {hoveredJob.job.isBottleneck && hoveredJob.job.bottleneckReason && (
                    <div style={{ marginTop: '10px', color: 'orange', fontSize: '0.8rem' }}>
                      <strong>Wait constraint:</strong> {hoveredJob.job.bottleneckReason}
                    </div>
                  )}
                  {(() => {
                    const wo = workOrders.find(w => w.id === hoveredJob.job.workOrderId);
                    if (!wo) return null;
                    const dueDate = new Date(wo.dueDate);
                    dueDate.setHours(23, 59, 59, 999);
                    const delayDays = getDelayDaysFromDue(hoveredJob.job.endDate, wo.dueDate);
                    return (
                      <div style={{ marginTop: '10px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        <div><strong>Due Date:</strong> {dueDate.toLocaleDateString()}</div>
                        {delayDays > 0 ? (
                          <div style={{ color: '#f59e0b' }}>Delay: +{delayDays} day{delayDays === 1 ? '' : 's'}</div>
                        ) : delayDays < 0 ? (
                          <div style={{ color: '#10b981' }}>Early by {Math.abs(delayDays)} day{Math.abs(delayDays) === 1 ? '' : 's'}</div>
                        ) : (
                          <div style={{ color: '#10b981' }}>On time</div>
                        )}
                      </div>
                    );
                  })()}
                  <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-glass)', display: 'grid', gridTemplateColumns: 'min-content 1fr', gap: '4px 12px' }}>
                    <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Start:</span> <span>{hoveredJob.job.startDate.toLocaleString()}</span>
                    <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>End:</span> <span>{hoveredJob.job.endDate.toLocaleString()}</span>
                  </div>
                  {(hoveredJob.job.isUrgent || hoveredJob.job.isBottleneck) && (
                    <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                       {hoveredJob.job.isUrgent && <span style={{ background: '#e11d48', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>Urgent Flag</span>}
                       {hoveredJob.job.isBottleneck && <span style={{ border: '1px dashed orange', color: 'orange', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>Wait Constraint</span>}
                    </div>
                  )}
                </div>
              )}
                </div>
              )}

              {scheduledGanttData.length > 0 && scheduleViewMode === 'spreadsheet' && (
                <>
                  <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', background: 'rgba(0,102,255,0.05)' }}>
                    <h3 style={{ marginBottom: '12px', fontSize: '1rem', color: 'var(--accent-cyan)' }}>Schedule Analysis</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Operations</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{scheduledGanttData.length}</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Bottleneck Operations</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'orange' }}>{scheduledGanttData.filter(j => j.isBottleneck).length}</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Urgent Operations</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#e11d48' }}>{scheduledGanttData.filter(j => j.isUrgent).length}</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Duration</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-blue)' }}>{(scheduledGanttData.reduce((acc, j) => acc + j.totalDurMins, 0) / 60).toFixed(1)} hrs</div>
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: '20px' }}>
                    <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', color: 'var(--accent-cyan)' }}>Detailed Schedule Spreadsheet</h3>
                    <div style={{ overflowX: 'auto', maxHeight: '600px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.05)', position: 'sticky', top: 0, zIndex: 1 }}>
                            <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-glass)', color: 'var(--accent-cyan)' }}>Work Order</th>
                            <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-glass)', color: 'var(--accent-cyan)' }}>Cable Details</th>
                            <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-glass)', color: 'var(--accent-cyan)' }}>Machine</th>
                            <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-glass)', color: 'var(--accent-cyan)' }}>Operation</th>
                            <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-glass)', color: 'var(--accent-cyan)' }}>Start Date</th>
                            <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-glass)', color: 'var(--accent-cyan)' }}>Start Time</th>
                            <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-glass)', color: 'var(--accent-cyan)' }}>End Date</th>
                            <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-glass)', color: 'var(--accent-cyan)' }}>End Time</th>
                            <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-glass)', color: 'var(--accent-cyan)' }}>Duration (mins)</th>
                            <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-glass)', color: 'var(--accent-cyan)' }}>Promised Due</th>
                            <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-glass)', color: 'var(--accent-cyan)' }}>Delay Days</th>
                            <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-glass)', color: 'var(--accent-cyan)' }}>Wait Reason</th>
                            <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-glass)', color: 'var(--accent-cyan)' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scheduledGanttData
                            .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
                            .map((job, idx) => {
                              const machine = machines.find(m => m.id === job.machineId);
                              const status = job.isUrgent ? 'Urgent' : job.isBottleneck ? 'Wait Constraint' : 'Normal';
                              return (
                                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                  <td style={{ padding: '8px', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>{job.workOrderId}</td>
                                  <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{job.cableDetails}</td>
                                  <td style={{ padding: '8px' }}>{machine ? `${machine.name} (${job.machineId})` : job.machineId}</td>
                                  <td style={{ padding: '8px' }}>{job.operation}</td>
                                  <td style={{ padding: '8px' }}>{job.startDate.toLocaleDateString()}</td>
                                  <td style={{ padding: '8px' }}>{job.startDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                  <td style={{ padding: '8px' }}>{job.endDate.toLocaleDateString()}</td>
                                  <td style={{ padding: '8px' }}>{job.endDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                  <td style={{ padding: '8px', textAlign: 'right' }}>{job.totalDurMins.toFixed(0)}</td>
                                  <td style={{ padding: '8px' }}>{(() => {
                                    const wo = workOrders.find(w => w.id === job.workOrderId);
                                    return wo ? new Date(wo.dueDate).toLocaleDateString() : '—';
                                  })()}</td>
                                  <td style={{ padding: '8px', color: job.endDate.getTime() > new Date((() => { const wo = workOrders.find(w => w.id === job.workOrderId); if (!wo) return job.endDate.toISOString(); const d = new Date(wo.dueDate); d.setHours(23, 59, 59, 999); return d.toISOString(); })()).getTime() ? 'orange' : 'var(--text-secondary)' }}>{(() => {
                                    const wo = workOrders.find(w => w.id === job.workOrderId);
                                    if (!wo) return '0';
                                    return getDelayDaysFromDue(job.endDate, wo.dueDate).toString();
                                  })()}</td>
                                  <td style={{ padding: '8px', color: job.isBottleneck ? 'orange' : 'var(--text-secondary)' }}>{job.bottleneckReason || '—'}</td>
                                  <td style={{ padding: '8px' }}>
                                    <span style={{
                                      background: job.isUrgent ? '#e11d48' : job.isBottleneck ? 'orange' : 'var(--accent-blue)',
                                      color: 'white',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontSize: '0.7rem'
                                    }}>
                                      {status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {scheduledGanttData.length > 0 && scheduleViewMode === 'calendar' && (
                <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--accent-cyan)' }}>Interactive Calendar View</h3>
                      <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        View scheduled operations by day, navigate weekly windows, and inspect job timing with built-in bottleneck context.
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <button onClick={() => { const prev = new Date(calendarAnchorDate); prev.setDate(prev.getDate() - 7); setCalendarAnchorDate(prev); }} style={{ ...btnStyle, background: 'rgba(255,255,255,0.1)', padding: '8px 14px' }}>Previous Week</button>
                      <button onClick={() => { const today = new Date(); today.setHours(0,0,0,0); setCalendarAnchorDate(today); }} style={{ ...btnStyle, background: 'rgba(255,255,255,0.1)', padding: '8px 14px' }}>Today</button>
                      <button onClick={() => { const next = new Date(calendarAnchorDate); next.setDate(next.getDate() + 7); setCalendarAnchorDate(next); }} style={{ ...btnStyle, background: 'rgba(255,255,255,0.1)', padding: '8px 14px' }}>Next Week</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '12px' }}>
                    {calendarDays.map(day => {
                      const dayKey = isoDay(day);
                      const entries = jobsByDay[dayKey] || [];
                      return (
                        <div key={dayKey} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: '12px', minHeight: '220px', padding: '14px', display: 'flex', flexDirection: 'column' }}>
                          <div style={{ marginBottom: '12px', fontWeight: '700', fontSize: '0.92rem' }}>{day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                          {entries.length === 0 ? (
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No work scheduled</div>
                          ) : (
                            entries.sort((a,b) => a.startDate.getTime() - b.startDate.getTime()).map((job, idx) => (
                              <div key={idx} style={{ background: job.isUrgent ? 'rgba(225,29,72,0.16)' : 'rgba(0,102,255,0.12)', borderRadius: '10px', padding: '10px', marginBottom: '10px', flexShrink: 0, cursor: 'default' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontWeight: '700', color: 'white' }}>{job.workOrderId}</span>
                                  <span style={{ fontSize: '0.7rem', color: 'white', background: job.isBottleneck ? 'rgba(249,115,22,0.25)' : 'rgba(16,185,129,0.25)', padding: '2px 6px', borderRadius: '999px' }}>{job.isBottleneck ? 'Wait Constraint' : 'On track'}</span>
                                </div>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '6px 0 0' }}>{job.operation}</div>
                                <div style={{ fontSize: '0.82rem', marginTop: '6px', color: 'white' }}>{job.startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {job.endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                {job.isBottleneck && job.bottleneckReason && (
                                  <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'orange' }}>Reason: {job.bottleneckReason}</div>
                                )}
                                {(() => {
                                  const wo = workOrders.find(w => w.id === job.workOrderId);
                                  if (!wo) return null;
                                  const dueDate = new Date(wo.dueDate);
                                  dueDate.setHours(23, 59, 59, 999);
                                  const delayDays = getDelayDaysFromDue(job.endDate, wo.dueDate);
                                  return (
                                    <div style={{ marginTop: '8px', fontSize: '0.75rem', color: delayDays > 0 ? '#f59e0b' : delayDays < 0 ? '#10b981' : 'var(--text-secondary)' }}>
                                      Due: {dueDate.toLocaleDateString()} {delayDays > 0 ? `· Delay +${delayDays}d` : delayDays < 0 ? `· Early ${Math.abs(delayDays)}d` : '· On time'}
                                    </div>
                                  );
                                })()}
                              </div>
                            ))
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
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
                     <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Path</th>
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
                         {(() => {
                            const pid = String(wo.routingId || '').toLowerCase().trim();
                            const exists = routings.some(r => (r.id || '').toLowerCase() === pid || (r.name || '').toLowerCase() === pid);
                            return (
                              <span style={{ color: exists ? 'var(--text-secondary)' : '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {wo.routingId || 'No Path'}
                                {(!exists && wo.routingId) && <span title="Routing Master Not Found! Ensure Routing ID or Name matches exactly." style={{ background: '#ef4444', color: 'white', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold', cursor: 'help' }}>!</span>}
                              </span>
                            )
                         })()}
                       </td>
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
                  { step: '06', title: 'Inspect the Gantt Chart — Hover Tooltips', detail: 'Each job block on the Gantt displays the work order ID abbreviation. Hover over any block to reveal a floating card showing: Work Order ID, cable details, operation name, assigned machine ID, total duration in minutes, start and end timestamps, and any active constraint flags (Urgent / Wait Constraint).' }
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
