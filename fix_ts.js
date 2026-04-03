import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Fix XLSX types
content = content.replace("sheet_to_json(wb.Sheets[wb.SheetNames[0]])", "sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]])");
content = content.replace("evt.target.result;", "evt.target?.result as string;");

// 2. Fix handleAddMachine
content = content.replace(
    /setMachines\(\[\.\.\.machines, \{ \.\.\.newMach \}\]\);\s+setNewMach\(\{ id: '', name: '', speed: 50, setupTime: 30, type: 'Extrusion' \}\);/g,
    `setMachines([...machines, { ...newMach }]); setNewMach({ id: '', name: '', maxCapacity: 10000, type: 'Extrusion' });`
);
// Wait, my previous refactor script replaced setNewMach already! What's at line 84? Wait, line 84 is the "machines" localStorage default!
// Oh, the first array element `setMachines] = useLocalStorage<Machine[]>('opcenter_machines', [ ... `
// Did I miss removing speed and setupTime from the default machines?
// Let's remove them via regex
content = content.replace(/, speed: \d+/g, '');
content = content.replace(/, setupTime: \d+/g, '');

// Also, the old globalSchedule wasn't properly removed because I used a bad regex match?
// Let's check if there are any remaining TS errors around speed or setupTime
// Wait, `error TS18046: 'row' is of type 'unknown'.` is fixed by `sheet_to_json<any>`.

fs.writeFileSync('src/App.tsx', content);
