import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("machineId: selectedMach || s.machineId, operation: s.operation,", "machineId: selectedMach || s.machineId, operation: s.operation,")
# Actually, the backward logic:
# `machineId: assignedM, operation: s.operation,`
# Wait, did it somehow overwrite both to use selectedMach?
text = text.replace("machineId: selectedMach || s.machineId, operation: s.operation,", "machineId: (typeof selectedMach !== 'undefined' ? selectedMach : (typeof assignedM !== 'undefined' ? assignedM : s.machineId)), operation: s.operation,")

# Or safer, replace `currentCursorTime`
text = text.replace("const assignMachine = (reqId: string, currentCursorTime: number): string => {", "const assignMachine = (reqId: string): string => {")

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
