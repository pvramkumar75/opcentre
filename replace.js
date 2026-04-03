import fs from 'fs';

let lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');

for(let i=0; i<lines.length; i++) {
  if(lines[i].includes('interface Machine { id: string; name: string; speed: number; setupTime: number; type: string; }')) {
    lines[i] = "interface Machine { id: string; name: string; speed: number; setupTime: number; maxCapacity?: number; type: string; }";
  }
  if(lines[i].includes("{ id: 'STR-61'")) {
    lines[i] = "    { id: 'STR-61', name: '61 B Stranding', speed: 100, setupTime: 45, maxCapacity: 50000, type: 'Conductor' },";
  }
  if(lines[i].includes("{ id: 'EXT-70'")) {
    lines[i] = "    { id: 'EXT-70', name: 'Extruder 70mm Ins.', speed: 150, setupTime: 60, maxCapacity: 100000, type: 'Extrusion' },";
  }
  if(lines[i].includes("{ id: 'DRM-TW'")) {
    lines[i] = "    { id: 'DRM-TW', name: 'Drum Twister', speed: 40, setupTime: 90, maxCapacity: 30000, type: 'Twisting' },";
  }
  if(lines[i].includes("{ id: 'EXT-100'")) {
    lines[i] = "    { id: 'EXT-100', name: 'Extruder 100mm Jack.', speed: 60, setupTime: 60, maxCapacity: 80000, type: 'Extrusion' },";
  }
  if(lines[i].includes("{ id: 'ARM-72'")) {
    lines[i] = "    { id: 'ARM-72', name: 'Armouring 72B', speed: 12, setupTime: 180, maxCapacity: 20000, type: 'Armouring' },";
  }
  if(lines[i].includes("{ id: 'EXT-120'")) {
    lines[i] = "    { id: 'EXT-120', name: 'Extruder 120mm Jack.', speed: 30, setupTime: 90, maxCapacity: 40000, type: 'Extrusion' },";
  }
  if(lines[i].includes("const [newMach, setNewMach] = useState<Machine>({ id: '', name: '', speed: 50, setupTime: 30, type: 'Extrusion' });")) {
     lines[i] = "  const [newMach, setNewMach] = useState<Machine>({ id: '', name: '', speed: 50, setupTime: 30, maxCapacity: 10000, type: 'Extrusion' });";
  }
  if(lines[i].includes("setNewMach({ id: '', name: '', speed: 50, setupTime: 30, type: 'Extrusion' });")) {
     lines[i] = "    setNewMach({ id: '', name: '', speed: 50, setupTime: 30, maxCapacity: 10000, type: 'Extrusion' });";
  }
}

// Table replacements using slice to replace exact sections based on known line numbers
// lines 510-513 is Table Headers
// lines 520-524 is Table Body
// lines 531-544 is Form

// But line numbers might shift. Let's find index.
let thIndex = lines.findIndex(l => l.includes('>Speed (m/min)</th>'));
if(thIndex !== -1) {
    lines.splice(thIndex, 3, 
       "                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Operating Speed</th>",
       "                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Changeover</th>",
       "                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Max Capacity</th>",
       "                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Action</th>"
    );
}

// re-evaluate all lines
let newLines = [];
let skipMode = false;
let formIndex = lines.findIndex(l => l.includes('>Add New Machine</h3>'));

for(let i=0; i<lines.length; i++) {
   if(lines[i].includes('<td style={{ padding: \'12px 8px\' }}>{m.speed} m/m</td>')) {
        newLines.push(lines[i]);
        newLines.push("                        <td style={{ padding: '12px 8px' }}>{m.setupTime} min</td>");
        newLines.push("                        <td style={{ padding: '12px 8px', color: '#10b981' }}>{m.maxCapacity ? m.maxCapacity.toLocaleString() + ' m' : 'N/A'}</td>");
        i++; // skip original setupTime td
        continue;
   }
   
   if(i === formIndex - 1) { // start of form panel
       skipMode = true;
       newLines.push(`              <div className="glass-panel" style={{ width: '400px', padding: '24px', height: 'fit-content', flexShrink: 0 }}>
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                  </div>
                  <button onClick={handleAddMachine} style={{...btnStyle, marginTop: '8px'}}><PlusCircle size={16}/> Save Machine Data</button>
                </div>
              </div>`);
   }
   
   if(skipMode && lines[i].includes('Save Machine Data</button>')) {
       // end of form panel next block
       skipMode = false;
       i+= 2; // skip closing divs
       continue;
   }
   
   if(!skipMode) {
      newLines.push(lines[i]);
   }
}

fs.writeFileSync('src/App.tsx', newLines.join('\\n'));
console.log('Update Complete!');
