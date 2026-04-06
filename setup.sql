-- Create tables for OpCentre scheduling app on Neon

CREATE TABLE IF NOT EXISTS machine_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS machines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  maxCapacity INTEGER,
  groupId TEXT REFERENCES machine_groups(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS routings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cableType TEXT,
  coreCount TEXT,
  conductorSize TEXT,
  steps JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS work_orders (
  id TEXT PRIMARY KEY,
  cableDetails TEXT NOT NULL,
  routingId TEXT REFERENCES routings(id),
  qty INTEGER NOT NULL,
  startDate TEXT NOT NULL,
  dueDate TEXT NOT NULL,
  isUrgent BOOLEAN DEFAULT FALSE,
  materialStatus TEXT DEFAULT 'Pending',
  priorityNumber INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default data
INSERT INTO machine_groups (id, name) VALUES 
  ('GRP-EXT', 'Extrusion Lines'),
  ('GRP-ARM', 'Armouring Lines')
ON CONFLICT (id) DO NOTHING;

INSERT INTO machines (id, name, type, maxCapacity, groupId) VALUES
  ('STR-61', '61 B Stranding', 'Conductor', 50000, NULL),
  ('EXT-70', 'Extruder 70mm Ins.', 'Extrusion', 100000, 'GRP-EXT'),
  ('DRM-TW', 'Drum Twister', 'Twisting', 30000, NULL),
  ('EXT-100', 'Extruder 100mm Jack.', 'Extrusion', 80000, 'GRP-EXT'),
  ('ARM-72', 'Armouring 72B', 'Armouring', 20000, 'GRP-ARM'),
  ('EXT-120', 'Extruder 120mm Jack.', 'Extrusion', 40000, 'GRP-EXT')
ON CONFLICT (id) DO NOTHING;

INSERT INTO routings (id, name, cableType, coreCount, conductorSize, steps) VALUES
  ('PATH-001', '3C x 95 sq.mm Armoured Standard', NULL, NULL, NULL, 
   '[{"seq": 1, "machineId": "STR-61", "operation": "Stranding", "waitTime": 0}, 
     {"seq": 2, "machineId": "EXT-70", "operation": "Core Insulation", "waitTime": 120}, 
     {"seq": 3, "machineId": "DRM-TW", "operation": "Laying Up", "waitTime": 0}, 
     {"seq": 4, "machineId": "EXT-100", "operation": "Inner Sheath", "waitTime": 60}, 
     {"seq": 5, "machineId": "ARM-72", "operation": "Wire Armouring", "waitTime": 0}, 
     {"seq": 6, "machineId": "EXT-120", "operation": "Outer Sheath", "waitTime": 0}]'::jsonb)
ON CONFLICT (id) DO NOTHING;