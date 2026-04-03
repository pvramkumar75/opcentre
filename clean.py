import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the residual speed inputs in forms if they still exist
content = re.sub(r'<div>\s*<label.*?Operating Speed.*?</label>\s*<input.*?speed: Number.*?\/>\s*</div>', '', content, flags=re.DOTALL)
content = re.sub(r'<div>\s*<label.*?Changeover Time.*?</label>\s*<input.*?setupTime: Number.*?\/>\s*</div>', '', content, flags=re.DOTALL)

# Also remove them if they look slightly different
content = re.sub(r'speed:\s*Number\(e\.target\.value\)', 'maxCapacity: Number(e.target.value)', content)
content = re.sub(r'setupTime:\s*Number\(e\.target\.value\)', 'maxCapacity: Number(e.target.value)', content)
content = re.sub(r'newMach\.speed\s*\|\|\s*\'\'', "newMach.maxCapacity || ''", content)
content = re.sub(r'newMach\.setupTime\s*\|\|\s*\'\'', "newMach.maxCapacity || ''", content)

# Remove speed/setupTime defaults
content = content.replace("speed: 50,", "")
content = content.replace("setupTime: 30,", "")
content = content.replace("speed: 50 ,", "")
content = content.replace("setupTime: 30 ,", "")

# Remove scheduledGanttData undefined errors (make sure it's defined globally)
if 'const [scheduledGanttData' not in content:
    content = content.replace(
        "const [activeTab, setActiveTab] = useState('dashboard');",
        "const [activeTab, setActiveTab] = useState('dashboard');\n  const [scheduledGanttData, setScheduledGanttData] = useState<GlobalScheduleStep[]>([]);"
    )

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
