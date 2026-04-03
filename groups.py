import re
import sys

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update Types
types_add = """interface MachineGroup { id: string; name: string; }
interface Machine { id: string; name: string; type: string; maxCapacity?: number; groupId?: string; }
"""
text = re.sub(r'interface Machine \{ id: string; name: string; type: string; maxCapacity\?: number; \}', types_add, text)


# 2. Add State for Groups
groups_state = """  const [machineGroups, setMachineGroups] = useLocalStorage<MachineGroup[]>('opcenter_groups', [
    { id: 'GRP-EXT', name: 'Extrusion Lines' },
    { id: 'GRP-ARM', name: 'Armouring Lines' }
  ]);
"""
# Find where machines state is
text = text.replace("  const [machines, setMachines] = useLocalStorage<Machine[]>('opcenter_machines', [",
                    groups_state + "\n  const [machines, setMachines] = useLocalStorage<Machine[]>('opcenter_machines', [")

# 3. Add to Menu
text = text.replace(
    "{ id: 'dashboard', label: 'Global Dashboard', icon: <BarChart3 size={18}/> },",
    "{ id: 'dashboard', label: 'Global Dashboard', icon: <BarChart3 size={18}/> },\n    { id: 'groups', label: 'Resource Groups', icon: <Layers size={18}/> },"
)


# 4. Form state for new Group
text = text.replace(
    "const [newMach, setNewMach] = useState<Machine>({ id: '', name: '', maxCapacity: 10000, type: 'Extrusion' });",
    "const [newGroup, setNewGroup] = useState<MachineGroup>({ id: '', name: '' });\n  const [newMach, setNewMach] = useState<Machine>({ id: '', name: '', maxCapacity: 10000, type: 'Extrusion', groupId: '' });"
)
text = text.replace(
    "setNewMach({ id: '', name: '', maxCapacity: 10000, type: 'Extrusion' });",
    "setNewMach({ id: '', name: '', maxCapacity: 10000, type: 'Extrusion', groupId: '' });"
)

# Handlers for Group
group_handlers = """  const handleAddGroup = () => {
    if(!newGroup.id || !newGroup.name) return;
    setMachineGroups([...machineGroups, { ...newGroup }]);
    setNewGroup({ id: '', name: '' });
  };
  const handleDeleteGroup = (id: string) => { setMachineGroups(machineGroups.filter(g => g.id !== id)); };
"""
text = text.replace("const handleAddMachine", group_handlers + "\n  const handleAddMachine")


# 5. Machine Database Form Update
old_mach_form = """                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Max Capacity</label>
                    <input type="number" placeholder="e.g. 50000" value={newMach.maxCapacity || ''} onChange={e=>setNewMach({...newMach, maxCapacity: Number(e.target.value)})} style={inputStyle} />
                  </div>"""
new_mach_form = """                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Resource Group</label>
                    <select value={newMach.groupId || ''} onChange={e=>setNewMach({...newMach, groupId: e.target.value})} style={inputStyle}>
                       <option value="">-- No Group assigned --</option>
                       {machineGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Max Capacity</label>
                    <input type="number" placeholder="e.g. 50000" value={newMach.maxCapacity || ''} onChange={e=>setNewMach({...newMach, maxCapacity: Number(e.target.value)})} style={inputStyle} />
                  </div>"""
text = text.replace(old_mach_form, new_mach_form)

# Add Group Column to Machine Table
text = text.replace(
    "<th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Max Capacity</th>",
    "<th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Group</th>\n                     <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Max Cap</th>"
)
old_mach_td = """<td style={{ padding: '12px 8px', color: '#10b981' }}>{m.maxCapacity ? m.maxCapacity.toLocaleString() + ' m' : 'N/A'}</td>"""
new_mach_td = """<td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{m.groupId || '-'}</td>\n                       <td style={{ padding: '12px 8px', color: '#10b981' }}>{m.maxCapacity ? m.maxCapacity.toLocaleString() + ' m' : 'N/A'}</td>"""
text = text.replace(old_mach_td, new_mach_td)


# 6. Routing Master Map Option Groups
old_select = """<option value="">-- Select --</option>
                                        {machines.map(m => <option key={m.id} value={m.id}>{m.id} ({m.name})</option>)}"""
new_select = """<option value="">-- Select --</option>
                                        <optgroup label="Resource Groups">
                                           {machineGroups.map(g => <option key={g.id} value={g.id}>{g.id} ({g.name})</option>)}
                                        </optgroup>
                                        <optgroup label="Specific Machines">
                                           {machines.map(m => <option key={m.id} value={m.id}>{m.id} ({m.name})</option>)}
                                        </optgroup>"""
text = text.replace(old_select, new_select)


# 7. Add The Group Tab Block
group_tab_ui = """        {/* RESOURCE GROUPS */}
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

"""

text = text.replace("{/* 3. MACHINE DATABASE */}", group_tab_ui + "        {/* 3. MACHINE DATABASE */}")

# 8. Gantt Scheduler Magic (Pick earliest machine from Group)
old_gant_logic = """        if(schedConfig.direction === 'Backward') {"""
new_gantt_logic = """        const assignMachine = (reqId: string, currentCursorTime: number): string => {
             const groupMatch = machineGroups.find(g => g.id === reqId);
             if(!groupMatch) return reqId; // It's already a specific machine
             
             const options = machines.filter(m => m.groupId === reqId);
             if(options.length === 0) return reqId; // Fallback to raw string if cluster is empty
             
             // Pick the earliest available
             options.sort((a,b) => (machAvail[a.id] || baseTime) - (machAvail[b.id] || baseTime));
             return options[0].id;
        };
        
        if(schedConfig.direction === 'Backward') {"""
text = text.replace(old_gant_logic, new_gantt_logic)

text = text.replace("machReady = machAvail[s.machineId] || baseTime;", "let selectedMach = assignMachine(s.machineId, pathTime);\n                let machReady = machAvail[selectedMach] || baseTime;")
text = text.replace("machineId: s.machineId,", "machineId: selectedMach || s.machineId,")
text = text.replace("machAvail[s.machineId] = actualEnd;", "machAvail[selectedMach] = actualEnd;")

# For backward scheduling mapping:
bb = """let dur = (wo.qty / DEFAULT_SPEED) + DEFAULT_SETUP;
                let end = backwardCursor;
                let start = end - dur * 60000;
                
                stepJobs.unshift({
                    workOrderId: wo.id, cableDetails: wo.cableDetails, machineId: s.machineId, operation: s.operation,"""
nn = """let dur = (wo.qty / DEFAULT_SPEED) + DEFAULT_SETUP;
                let end = backwardCursor;
                let start = end - dur * 60000;
                let assignedM = assignMachine(s.machineId, start);
                
                stepJobs.unshift({
                    workOrderId: wo.id, cableDetails: wo.cableDetails, machineId: assignedM, operation: s.operation,"""
text = text.replace(bb, nn)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
