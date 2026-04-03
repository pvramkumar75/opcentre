import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Update interface Routing
content = content.replace(
    "interface Routing { id: string; name: string; steps: RouteStep[]; }",
    "interface Routing { id: string; name: string; cableType?: string; coreCount?: string; conductorSize?: string; steps: RouteStep[]; }"
);

// 2. Update newRoute intial state
content = content.replace(
    "const [newRoute, setNewRoute] = useState<Routing>({ id: '', name: '', steps: [] });",
    "const [newRoute, setNewRoute] = useState<Routing>({ id: '', name: '', cableType: '', coreCount: '', conductorSize: '', steps: [] });"
);

// 3. Update handleSaveRoute to reset with new properties
content = content.replace(
    "setNewRoute({ id: '', name: '', steps: [] });",
    "setNewRoute({ id: '', name: '', cableType: '', coreCount: '', conductorSize: '', steps: [] });"
);


// 4. Update the routing masters view panel
const oldUIPanel = `<div className="glass-panel" style={{ width: '400px', padding: '24px', height: 'fit-content', flexShrink: 0 }}>
                <h3 style={{ marginBottom: '16px' }}>Build New Path</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                  <input placeholder="Path Number (e.g. PATH-002)" value={newRoute.id} onChange={e=>setNewRoute({...newRoute, id: e.target.value})} style={inputStyle} />
                  <input placeholder="Path Description" value={newRoute.name} onChange={e=>setNewRoute({...newRoute, name: e.target.value})} style={inputStyle} />
                </div>

                <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h4>Assign Sequential Process</h4>
                  <select value={routeStep.machineId} onChange={e=>setRouteStep({...routeStep, machineId: e.target.value})} style={inputStyle}>
                    <option value="">-- Select Machine Platform --</option>
                    {machines.map(m => <option key={m.id} value={m.id}>{m.id} ({m.name})</option>)}
                  </select>
                  <input placeholder="Operation Standard (e.g. Extrusion)" value={routeStep.operation} onChange={e=>setRouteStep({...routeStep, operation: e.target.value})} style={inputStyle} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label htmlFor="wait" style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>Post-Op Cooling/Wait Time:</label>
                    <input id="wait" type="number" placeholder="Mins" value={routeStep.waitTime || ''} onChange={e=>setRouteStep({...routeStep, waitTime: Number(e.target.value)})} style={{...inputStyle, width: '100px'}} />
                  </div>
                  <button onClick={handleAddRouteStep} style={{...btnStyle, background: 'rgba(255,255,255,0.1)'}}>Push Sequence Step</button>
                </div>

                {newRoute.steps.length > 0 && (
                  <div style={{ marginTop: '20px', background: 'rgba(0,0,0,0.1)', padding: '12px', borderRadius: '8px' }}>
                    <h4 style={{ marginBottom: '10px', fontSize: '0.85rem' }}>Current Sequence Lineage:</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                      {newRoute.steps.map(s => (
                        <div key={s.seq} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '4px' }}>
                          <span>{s.seq}. {s.machineId} <span style={{ opacity: 0.6, marginLeft: '6px' }}>{s.operation}</span> {s.waitTime ? <span style={{color: 'orange'}}> (Wait {s.waitTime}m)</span> : null}</span>
                          <button onClick={() => handleRemoveRouteStep(s.seq)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14}/></button>
                        </div>
                      ))}
                    </div>
                    <button onClick={handleSaveRoute} style={{...btnStyle, width: '100%'}}><Route size={16}/> Lock & Save Master</button>
                  </div>
                )}
              </div>`;

const newUIPanel = `<div style={{ backgroundColor: '#f2f4f7', padding: '12px', border: '1px solid #7a98b1', minWidth: '550px', flex: '1 1 500px', flexShrink: 0, fontFamily: 'Arial, sans-serif' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#d0daf0', border: '1px solid #7a98b1', padding: '4px 12px', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, color: '#333', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Info size={16}/> Create Routing Master</h3>
                    <button onClick={handleSaveRoute} style={{ backgroundColor: '#f2f2f2', border: '1px solid #7a98b1', padding: '2px 12px', cursor: 'pointer', color: '#333', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={14}/> Save Master (Ctrl+S)</button>
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
                                        {machines.map(m => <option key={m.id} value={m.id}>{m.id} ({m.name})</option>)}
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
              </div>`;

content = content.replace(oldUIPanel, newUIPanel);

// Also update display for Cable type on existing routings list
const oldRouteDisp = `<h3 style={{ margin: 0, color: 'var(--accent-cyan)' }}>{r.id}: {r.name}</h3>`;
const newRouteDisp = `<div style={{ display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ margin: 0, color: 'var(--accent-cyan)' }}>{r.id}: {r.name}</h3>
                        {(r.cableType || r.coreCount || r.conductorSize) && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            {r.cableType && <span>Cable: {r.cableType} | </span>}
                            {r.coreCount && <span>Cores: {r.coreCount} | </span>}
                            {r.conductorSize && <span>Size: {r.conductorSize}</span>}
                          </div>
                        )}
                      </div>`;
content = content.replace(oldRouteDisp, newRouteDisp);

fs.writeFileSync('src/App.tsx', content);
console.log('Update Complete!');
