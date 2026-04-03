with open('src/App.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace Table Headers
code = code.replace(
    '''<th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Speed (m/min)</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Setup (min)</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Action</th>''',
    '''<th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Speed (m/min)</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Setup (min)</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Max Cap (m)</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Action</th>'''
)

# Replace Table Rows
code = code.replace(
    '''<td style={{ padding: '12px 8px' }}>{m.speed} m/m</td>
                        <td style={{ padding: '12px 8px' }}>{m.setupTime} min</td>
                        <td style={{ padding: '12px 8px' }}>
                          <button''',
    '''<td style={{ padding: '12px 8px' }}>{m.speed} m/m</td>
                        <td style={{ padding: '12px 8px' }}>{m.setupTime} min</td>
                        <td style={{ padding: '12px 8px', color: '#10b981' }}>{m.maxCapacity ? m.maxCapacity.toLocaleString() : 'N/A'}</td>
                        <td style={{ padding: '12px 8px' }}>
                          <button'''
)

# Replace Form
form_old = '''<div className="glass-panel" style={{ width: '350px', padding: '24px', height: 'fit-content', flexShrink: 0 }}>
                <h3 style={{ marginBottom: '16px' }}>Add New Machine</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input placeholder="Machine ID (e.g. BUN-200)" value={newMach.id} onChange={e=>setNewMach({...newMach, id: e.target.value})} style={inputStyle} />
                  <input placeholder="Machine Name (e.g. Buncher)" value={newMach.name} onChange={e=>setNewMach({...newMach, name: e.target.value})} style={inputStyle} />
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <input type="number" placeholder="Speed m/min" value={newMach.speed || ''} onChange={e=>setNewMach({...newMach, speed: Number(e.target.value)})} style={inputStyle} />
                    <input type="number" placeholder="Setup mins" value={newMach.setupTime || ''} onChange={e=>setNewMach({...newMach, setupTime: Number(e.target.value)})} style={inputStyle} />
                  </div>
                  <button onClick={handleAddMachine} style={btnStyle}><PlusCircle size={16}/> Save Machine Data</button>
                </div>
              </div>'''

form_new = '''<div className="glass-panel" style={{ width: '400px', padding: '24px', height: 'fit-content', flexShrink: 0 }}>
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
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Max Capacity (Meters/run)</label>
                    <input type="number" placeholder="e.g. 50000" value={newMach.maxCapacity || ''} onChange={e=>setNewMach({...newMach, maxCapacity: Number(e.target.value)})} style={inputStyle} />
                  </div>
                  <button onClick={handleAddMachine} style={{...btnStyle, marginTop: '8px'}}><PlusCircle size={16}/> Save Machine Data</button>
                </div>
              </div>'''

code = code.replace(form_old, form_new)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
print("Replaced")
