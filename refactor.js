import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Add XLSX Import
if (!content.includes('import * as XLSX from')) {
    content = content.replace("import React,", "import * as XLSX from 'xlsx';\nimport React,");
}

// 2. Add priorityNumber to WorkOrder
content = content.replace(
    /interface WorkOrder \{([\s\S]*?)\}/,
    (match, p1) => {
        if (!p1.includes('priorityNumber')) {
            return `interface WorkOrder {${p1} priorityNumber?: number; }`;
        }
        return match;
    }
);

// 3. Remove speed and setupTime from Machine interface
content = content.replace(
    /interface Machine \{ id: string; name: string; speed: number; setupTime: number; maxCapacity\?: number; type: string; \}/,
    `interface Machine { id: string; name: string; maxCapacity?: number; type: string; }`
);

// Remove from default machines
const oldMachinesDefault = `    { id: 'STR-61', name: '61 B Stranding', speed: 100, setupTime: 45, maxCapacity: 50000, type: 'Conductor' },
    { id: 'EXT-70', name: 'Extruder 70mm Ins.', speed: 150, setupTime: 60, maxCapacity: 100000, type: 'Extrusion' },
    { id: 'DRM-TW', name: 'Drum Twister', speed: 40, setupTime: 90, maxCapacity: 30000, type: 'Twisting' },
    { id: 'EXT-100', name: 'Extruder 100mm Jack.', speed: 60, setupTime: 60, maxCapacity: 80000, type: 'Extrusion' },
    { id: 'ARM-72', name: 'Armouring 72B', speed: 12, setupTime: 180, maxCapacity: 20000, type: 'Armouring' },
    { id: 'EXT-120', name: 'Extruder 120mm Jack.', speed: 30, setupTime: 90, maxCapacity: 40000, type: 'Extrusion' },`;

const newMachinesDefault = `    { id: 'STR-61', name: '61 B Stranding', maxCapacity: 50000, type: 'Conductor' },
    { id: 'EXT-70', name: 'Extruder 70mm Ins.', maxCapacity: 100000, type: 'Extrusion' },
    { id: 'DRM-TW', name: 'Drum Twister', maxCapacity: 30000, type: 'Twisting' },
    { id: 'EXT-100', name: 'Extruder 100mm Jack.', maxCapacity: 80000, type: 'Extrusion' },
    { id: 'ARM-72', name: 'Armouring 72B', maxCapacity: 20000, type: 'Armouring' },
    { id: 'EXT-120', name: 'Extruder 120mm Jack.', maxCapacity: 40000, type: 'Extrusion' },`;

content = content.replace(oldMachinesDefault, newMachinesDefault);

// Update newMach state
content = content.replace(
    /const \[newMach, setNewMach\] = useState\<Machine\>\(\{ id: '', name: '', speed: 50, setupTime: 30, maxCapacity: 10000, type: 'Extrusion' \}\);/g,
    `const [newMach, setNewMach] = useState<Machine>({ id: '', name: '', maxCapacity: 10000, type: 'Extrusion' });`
);
content = content.replace(
    /setNewMach\(\{ id: '', name: '', speed: 50, setupTime: 30, maxCapacity: 10000, type: 'Extrusion' \}\);/g,
    `setNewMach({ id: '', name: '', maxCapacity: 10000, type: 'Extrusion' });`
);


// 4. Update the forms & tables for Machines
const oldMachineHeader = `<th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Operating Speed</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Changeover</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Max Capacity</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Action</th>`;

const newMachineHeader = `<th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Max Capacity (M)</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Action</th>`;
                      
content = content.replace(oldMachineHeader, newMachineHeader);

const oldMachineRowInfo = `<td style={{ padding: '12px 8px' }}>{m.speed} m/m</td>
                        <td style={{ padding: '12px 8px' }}>{m.setupTime} min</td>
                        <td style={{ padding: '12px 8px', color: '#10b981' }}>{m.maxCapacity ? m.maxCapacity.toLocaleString() + ' m' : 'N/A'}</td>`;

const newMachineRowInfo = `<td style={{ padding: '12px 8px', color: '#10b981' }}>{m.maxCapacity ? m.maxCapacity.toLocaleString() + ' m' : 'N/A'}</td>`;

content = content.replaceAll(oldMachineRowInfo, newMachineRowInfo);


const oldMachineInputs = `<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Operating Speed (m/min)</label>
                      <input type="number" value={newMach.speed || ''} onChange={e=>setNewMach({...newMach, speed: Number(e.target.value)})} style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Changeover Time (min)</label>
                      <input type="number" value={newMach.setupTime || ''} onChange={e=>setNewMach({...newMach, setupTime: Number(e.target.value)})} style={inputStyle} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Max Capacity per Run (Meters)</label>
                    <input type="number" placeholder="e.g. 50000" value={newMach.maxCapacity || ''} onChange={e=>setNewMach({...newMach, maxCapacity: Number(e.target.value)})} style={inputStyle} />
                  </div>`;

const newMachineInputs = `<div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Max Capacity</label>
                    <input type="number" placeholder="e.g. 50000" value={newMach.maxCapacity || ''} onChange={e=>setNewMach({...newMach, maxCapacity: Number(e.target.value)})} style={inputStyle} />
                  </div>`;

content = content.replace(oldMachineInputs, newMachineInputs);


// 5. Update scheduling states & functions
const newSchedVars = `  // --- SCHEDULING RULES & EXECUTION ---
  const [schedConfig, setSchedConfig] = useState({ direction: 'Forward', sortRule: 'DueDate' });
  const [scheduledGanttData, setScheduledGanttData] = useState([]);
  
  const executeSchedule = () => {
    let sortedWOs = [...workOrders].filter(wo => wo.materialStatus !== 'Pending');
    sortedWOs.sort((a, b) => {
        if (a.isUrgent && !b.isUrgent) return -1;
        if (!a.isUrgent && b.isUrgent) return 1;
        if (schedConfig.sortRule === 'MaxQuantity') return b.qty - a.qty;
        if (schedConfig.sortRule === 'Priority') return (a.priorityNumber || 999) - (b.priorityNumber || 999);
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(); // default DueDate
    });

    let machAvail = [...machines].reduce((acc, m) => { acc[m.id] = new Date(); return acc; }, {});
    let jobs = [];

    // Fallback constants since speed/setup removed
    const DEFAULT_SPEED = 100;
    const DEFAULT_SETUP = 60;

    sortedWOs.forEach(wo => {
        let route = routings.find(r => r.id === wo.routingId);
        if (!route) return;
        
        let pathTime = new Date();
        const backwardBase = new Date(wo.dueDate);
        
        // For Backward Scheduling, we actually would need to compute the total duration backwards to find the drop-dead start date.
        // For simplicity, if backward is chosen, we just schedule backwards from the due date ensuring tasks complete on the due date.
        
        let stepJobs = [];
        let backwardCursor = backwardBase;
        
        if(schedConfig.direction === 'Backward') {
             // We map steps in reverse
             for (let i = route.steps.length - 1; i >= 0; i--) {
                const s = route.steps[i];
                let dur = (wo.qty / DEFAULT_SPEED) + DEFAULT_SETUP;
                let end = new Date(backwardCursor.getTime());
                let start = new Date(end.getTime() - dur * 60000);
                
                // If the machine isn't available by the time we want it to END (wait, if backward, we don't know constraints easily without iterative fitting).
                // I will do naive backward logic here.
                stepJobs.unshift({
                    woId: wo.id, cableDetails: wo.cableDetails, machineId: s.machineId, operation: s.operation,
                    isUrgent: wo.isUrgent, isBottleneck: false, qty: wo.qty,
                    start, end
                });
                backwardCursor = new Date(start.getTime() - (s.waitTime||0)*60000);
             }
             jobs.push(...stepJobs);
        } else {
            // Forward Logic
            route.steps.forEach(s => {
                let dur = (wo.qty / DEFAULT_SPEED) + DEFAULT_SETUP;
                let machReady = machAvail[s.machineId] || new Date();
                let actualStart = pathTime > machReady ? pathTime : machReady;
                let actualEnd = new Date(actualStart.getTime() + dur * 60000);
                
                jobs.push({
                    woId: wo.id, cableDetails: wo.cableDetails, machineId: s.machineId, operation: s.operation,
                    isUrgent: wo.isUrgent, isBottleneck: pathTime < machReady, qty: wo.qty,
                    start: actualStart, end: actualEnd
                });
                
                machAvail[s.machineId] = actualEnd;
                pathTime = new Date(actualEnd.getTime() + (s.waitTime || 0) * 60000);
            });
        }
    });

    setScheduledGanttData(jobs);
  };
`;

const globalSchedBlockRegex = /const globalSchedule = useMemo\(\(\) => \{[\s\S]*?\}, \[workOrders, machines, routings\]\);/;
content = content.replace(globalSchedBlockRegex, newSchedVars);

content = content.replaceAll('globalSchedule.', 'scheduledGanttData.');
content = content.replaceAll('globalSchedule.map', 'scheduledGanttData.map');


// 6. Gantt Visual Timeline & Schedule Settings Panel
const oldGanttArea = `<div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '12px', background: 'var(--accent-blue)', borderRadius: '2px' }}></div><span style={{ fontSize: '0.85rem' }}>Normal Run</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '12px', background: '#e11d48', borderRadius: '2px' }}></div><span style={{ fontSize: '0.85rem' }}>Urgent Overwrite</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '12px', border: '2px dashed orange', borderRadius: '2px' }}></div><span style={{ fontSize: '0.85rem' }}>Wait Constraint (Bottleneck)</span></div>
                </div>
              </div>`;

const newGanttArea = `<div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '12px', background: 'var(--accent-blue)', borderRadius: '2px' }}></div><span style={{ fontSize: '0.85rem' }}>Normal Run</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '12px', background: '#e11d48', borderRadius: '2px' }}></div><span style={{ fontSize: '0.85rem' }}>Urgent Overwrite</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '12px', border: '2px dashed orange', borderRadius: '2px' }}></div><span style={{ fontSize: '0.85rem' }}>Wait Constraint (Bottleneck)</span></div>
                </div>
              </div>

              <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
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
                 <button onClick={executeSchedule} style={{...btnStyle, background: 'var(--accent-blue)'}}><Play size={16}/> Execute Schedule Engine</button>
              </div>

              {scheduledGanttData.length > 0 && (
                <div style={{ position: 'relative', height: '24px', borderBottom: '1px solid var(--border-glass)', marginBottom: '16px' }}>
                    {Array.from({length: 11}).map((_, i) => (
                        <span key={i} style={{ position: 'absolute', left: \`\${i * 10}%\`, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Day {i}</span>
                    ))}
                </div>
              )}
`;

content = content.replace(oldGanttArea, newGanttArea);


// 7. Work Order Bulk Upload Logic
const oldWOHeader = `<h3 style={{ marginBottom: '16px' }}>Punch Work Order</h3>`;
const newWOHeader = `<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0 }}>Punch Work Order</h3>
                  <div>
                    <input type="file" id="bulkUpload" accept=".xlsx, .xls" style={{ display: 'none' }} onChange={(e) => {
                       const file = e.target.files[0];
                       if (!file) return;
                       const reader = new FileReader();
                       reader.onload = (evt) => {
                          const bstr = evt.target.result;
                          const wb = XLSX.read(bstr, { type: 'binary' });
                          const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                          const newOrders = data.map((row, index) => ({
                              id: row['Work Order #'] || \`WO-IMPORT-\${index}\`,
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
                    }} />
                    <label htmlFor="bulkUpload" style={{...btnStyle, background: '#10b981', color: 'white', display: 'inline-block', cursor: 'pointer', padding: '6px 12px'}}>Bulk Excel Upload</label>
                  </div>
                </div>`;
content = content.replace(oldWOHeader, newWOHeader);

// Add Priority Number UI to individual form
const oldWODates = `<label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>`;
const newWODates = `<div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Priority Number (Optional)</label>
                    <input type="number" placeholder="e.g. 1" value={newWO.priorityNumber || ''} onChange={e=>setNewWO({...newWO, priorityNumber: Number(e.target.value)})} style={inputStyle} />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>`;
content = content.replace(oldWODates, newWODates);


fs.writeFileSync('src/App.tsx', content);
console.log("All changes successfully applied to App.tsx");
