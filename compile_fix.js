import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const t2 = `  const globalSchedule: GlobalScheduleStep[] = useMemo(() => {
    const sortedOrders = [...workOrders].sort((a, b) => {
        if (a.isUrgent && !b.isUrgent) return -1;
        if (!a.isUrgent && b.isUrgent) return 1;
        if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        return 0;
    });

    const machineAvailableAt: Record<string, number> = {};
    const steps: GlobalScheduleStep[] = [];

    const baseDate = new Date();
    baseDate.setHours(8, 0, 0, 0); 
    const baseTime = baseDate.getTime(); 

    sortedOrders.forEach(wo => {
        if (wo.materialStatus === 'Pending') return;

        const routing = routings.find(r => r.id === wo.routingId);
        if(!routing) return;

        let currentOrderTime = baseTime;
        const woStart = new Date(wo.startDate).getTime();
        if (woStart > currentOrderTime) currentOrderTime = woStart;

        routing.steps.forEach((step) => {
            const mach = machines.find(m => m.id === step.machineId) || { id: step.machineId, name: 'Unknown', type: 'Unknown' };
            const runTimeMins = wo.qty / mach.speed;
            const totalDurMins = mach.setupTime + runTimeMins;
            const totalDurMs = totalDurMins * 60000;

            let machAvail = machineAvailableAt[step.machineId] || baseTime;
            
            let start = Math.max(currentOrderTime, machAvail);
            let isBottleneck = start > currentOrderTime; 

            let end = start + totalDurMs;
            
            steps.push({
                workOrderId: wo.id,
                cableDetails: wo.cableDetails,
                isUrgent: wo.isUrgent,
                machineId: step.machineId,
                operation: step.operation,
                startDate: new Date(start),
                endDate: new Date(end),
                totalDurMins,
                isBottleneck
            });

            machineAvailableAt[step.machineId] = end;
            currentOrderTime = end + (step.waitTime || 0) * 60000;
        });
    });

    return steps;
  }, [workOrders, routings, machines]);`;

content = content.replace(t2, "");

content = content.replace(
  "  const minGanttTime = useMemo(() => Math.min(...scheduledGanttData.map(s => s.startDate.getTime())), [globalSchedule]);",
  "  const minGanttTime = useMemo(() => scheduledGanttData.length > 0 ? Math.min(...scheduledGanttData.map(s => s.startDate.getTime())) : new Date().getTime(), [scheduledGanttData]);"
);

content = content.replace(
  "  const maxGanttTime = useMemo(() => Math.max(...scheduledGanttData.map(s => s.endDate.getTime())), [globalSchedule]);",
  "  const maxGanttTime = useMemo(() => scheduledGanttData.length > 0 ? Math.max(...scheduledGanttData.map(s => s.endDate.getTime())) : new Date().getTime() + 86400000, [scheduledGanttData]);"
);

// We still had the speed and setup error.
content = content.replace(/const runTimeMins = wo\.qty \/ mach\.speed;/g, "");
content = content.replace(/const totalDurMins = mach\.setupTime \+ runTimeMins;/g, "");

content = content.replace(
  "const file = e.target.files[0];",
  "const file = e.target.files?.[0];"
);
content = content.replace(
  "const data = XLSX.utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]]);\n                          const newOrders = data.map((row, index)",
  "const data = XLSX.utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]]);\n                          const newOrders = data.map((row: any, index: number)"
);

fs.writeFileSync('src/App.tsx', content);
