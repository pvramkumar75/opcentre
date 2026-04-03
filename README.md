# OpCenter Cable: Advanced Planning and Scheduling (APS)

## Versioning & Changelog
**v1.0.0 - Initial APS Release**
- Deployed Machine Master Database with velocity matrices
- Built Standard Operating Pipeline (Routing Planner) with sequence logic
- Added "What-If" Simulation sandbox scenario testing engine
- Integrated Inter-operation Slack/Cooling timers visually generating block-delays
- Built Gantt Chart Visualization dynamically projecting job timeline using (Quantity/Velocity) algorithms

---

## Overview
OpCenter Cable is a custom web application modeled after the core capabilities of **Siemens Opcenter APS**. It operates as a high-fidelity scheduling engine specifically tailored for the precise realities of the cable production industry—calculating timelines for Extruders, Braiders, Twisters, and Stranding machines.

## Core Capabilities

### 1. Machine Master Database
- **Asset Registration:** Dynamically add and remove manufacturing lines (e.g., *Extruder 70mm, Drum Twister, Armouring 72B*).
- **Performance Profiling:** Defines the operational parameters for each machine, including running speeds (Meters per Minute) and standard prerequisite Setup Times.

### 2. Process Routing Logic (SOPs)
- **Standard Operating Pipelines:** Build reusable execution paths that link multiple machines in a predefined sequence (e.g., Stranding -> Core Insulation -> Laying Up -> Outer Sheath).
- **Inter-Operation Slack Constraints:** Inheriting advanced APS mechanics, Planners can define explicit **Cooling or Wait Times** between specific nodes, forcing the schedule to accommodate idle curing periods.

### 3. Work Order Management
- **Production Pipeline:** Track active work orders, target quantities (Meters), and requested start dates mapped against your defined process routes.
- **Material Flags:** Manage input dependencies by toggling Material State between *Available (Ready)* and *Pending (Constraint)*.

### 4. Interactive "What-If" Analysis
- **Impact Simulation:** Test urgent run requests or hypothetical job quantities without physically augmenting the locally saved database. 
- **Isolated Sandboxing:** Allows production planners to generate the Gantt chart in a "Sandbox Simulation" mode purely for evaluation purposes.

### 5. Automated Schedule Generation (Execution Gantt)
- **Mathematical Timeline Resolution:** Automatically computes down to the exact sequential minute when a process will start, complete, and escalate to the subsequent division based on (Quantity ÷ Speed).
- **Visual Gantt Rendering:** Renders the computed schedule as a time escalation map, highlighting active processing blocks, wait-time idle blocks, and material-deficit alerts.
- **Projected Completion Targeting:** Accurately issues the final hour and finish date for a specific cable job based on aggregated multi-machine mathematics.
