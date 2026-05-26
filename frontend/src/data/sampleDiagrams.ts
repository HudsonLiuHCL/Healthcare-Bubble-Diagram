// Pre-built sample bubble diagrams for demonstration

export interface SampleDiagram {
  id: string
  title: string
  prompt: string
  description: string
  tags: string[]
  nodes: SampleNode[]
  edges: SampleEdge[]
  program_data: {
    departments: Department[]
    total_area_sqm: number
    total_beds: number
    summary: string
  }
}

interface SampleNode {
  id: string
  type: 'bubbleNode'
  position: { x: number; y: number }
  data: {
    name: string; area_sqm: number; type: string
    color: string; size: number; zone?: string
    description?: string; beds?: number
  }
}

interface SampleEdge {
  id: string; source: string; target: string
  type?: string; animated?: boolean
  style?: { stroke: string; strokeWidth: number; strokeDasharray?: string }
  data?: { strength: string }
}

interface Department {
  id: string; name: string; area_sqm: number
  type: string; color: string; zone?: string
  beds?: number; description?: string
}

function sz(area: number) { return Math.max(80, Math.min(200, Math.round(Math.sqrt(area) * 3.8))) }

const req = (src: string, tgt: string, color: string): SampleEdge => ({
  id: `${src}-${tgt}`, source: src, target: tgt, type: 'smoothstep',
  animated: true, style: { stroke: color, strokeWidth: 3 }, data: { strength: 'required' },
})
const pref = (src: string, tgt: string, color = '#4f6ef7'): SampleEdge => ({
  id: `${src}-${tgt}`, source: src, target: tgt, type: 'smoothstep',
  animated: false, style: { stroke: color, strokeWidth: 2 }, data: { strength: 'preferred' },
})

// ─── Diagram 1: 100-Bed Community Hospital ───────────────────────────────────

const d1Nodes: SampleNode[] = [
  { id: 'ed',        type: 'bubbleNode', position: { x: 20,  y: 330 }, data: { name: 'Emergency Dept',         area_sqm: 650,  type: 'emergency',   color: '#ef4444', size: sz(650),  zone: 'clinical',    beds: 20, description: '20 treatment bays, trauma room, triage' } },
  { id: 'icu',       type: 'bubbleNode', position: { x: 130, y: 80  }, data: { name: 'ICU',                     area_sqm: 650,  type: 'icu',         color: '#ec4899', size: sz(650),  zone: 'clinical',    beds: 12, description: '12-bed mixed medical/surgical ICU' } },
  { id: 'surg',      type: 'bubbleNode', position: { x: 370, y: 50  }, data: { name: 'Surgery Suite',           area_sqm: 950,  type: 'surgery',     color: '#8b5cf6', size: sz(950),  zone: 'clinical',    description: '4 ORs + 2 procedure rooms + PACU' } },
  { id: 'inpatient', type: 'bubbleNode', position: { x: 640, y: 80  }, data: { name: 'Med/Surg Inpatient',      area_sqm: 2300, type: 'inpatient',   color: '#3b82f6', size: sz(2300), zone: 'clinical',    beds: 68, description: '68 beds in private rooms' } },
  { id: 'radiology', type: 'bubbleNode', position: { x: 190, y: 265 }, data: { name: 'Radiology & Imaging',     area_sqm: 580,  type: 'radiology',   color: '#a78bfa', size: sz(580),  zone: 'diagnostic',  description: 'CT, MRI, X-ray, Ultrasound, Fluoroscopy' } },
  { id: 'lab',       type: 'bubbleNode', position: { x: 430, y: 255 }, data: { name: 'Clinical Laboratory',     area_sqm: 380,  type: 'laboratory',  color: '#fbbf24', size: sz(380),  zone: 'diagnostic',  description: 'Core lab, blood bank, pathology' } },
  { id: 'pharmacy',  type: 'bubbleNode', position: { x: 620, y: 280 }, data: { name: 'Pharmacy',                area_sqm: 230,  type: 'pharmacy',    color: '#84cc16', size: sz(230),  zone: 'support',     description: 'Inpatient dispensing + retail window' } },
  { id: 'outpatient',type: 'bubbleNode', position: { x: 640, y: 450 }, data: { name: 'Outpatient Clinics',      area_sqm: 820,  type: 'outpatient',  color: '#10b981', size: sz(820),  zone: 'clinical',    description: 'Primary care + 4 specialty clinics' } },
  { id: 'lobby',     type: 'bubbleNode', position: { x: 360, y: 470 }, data: { name: 'Main Lobby & Reception',  area_sqm: 360,  type: 'public',      color: '#f97316', size: sz(360),  zone: 'public',      description: 'Main entrance, wayfinding, gift shop' } },
  { id: 'admin',     type: 'bubbleNode', position: { x: 80,  y: 520 }, data: { name: 'Administration',         area_sqm: 290,  type: 'admin',       color: '#14b8a6', size: sz(290),  zone: 'admin',       description: 'Exec offices, HR, finance, medical records' } },
  { id: 'support',   type: 'bubbleNode', position: { x: 200, y: 460 }, data: { name: 'Support Services',       area_sqm: 450,  type: 'support',     color: '#6b7280', size: sz(450),  zone: 'service',     description: 'Food service, laundry, sterile processing, EVS' } },
]

const d1Edges: SampleEdge[] = [
  req('ed', 'radiology', '#ef4444'), req('ed', 'icu', '#ef4444'), req('ed', 'surg', '#ef4444'),
  req('surg', 'icu', '#8b5cf6'),
  pref('surg', 'inpatient', '#8b5cf6'), pref('radiology', 'lab', '#a78bfa'),
  pref('radiology', 'inpatient', '#a78bfa'), pref('pharmacy', 'icu', '#84cc16'),
  pref('pharmacy', 'inpatient', '#84cc16'), pref('lab', 'surg', '#fbbf24'),
  pref('lobby', 'outpatient'), pref('lobby', 'admin'), pref('support', 'surg', '#6b7280'),
  pref('inpatient', 'radiology', '#3b82f6'),
]

// ─── Diagram 2: Ambulatory Surgery Center ────────────────────────────────────

const d2Nodes: SampleNode[] = [
  { id: 'reception', type: 'bubbleNode', position: { x: 340, y: 400 }, data: { name: 'Reception & Check-in',    area_sqm: 320,  type: 'public',      color: '#f97316', size: sz(320),  zone: 'public',     description: 'Registration, waiting, patient check-in' } },
  { id: 'preop',     type: 'bubbleNode', position: { x: 130, y: 280 }, data: { name: 'Pre-Op / PACU',           area_sqm: 550,  type: 'surgery',     color: '#8b5cf6', size: sz(550),  zone: 'clinical',   beds: 12, description: '8 pre-op bays + 4 PACU bays' } },
  { id: 'ors',       type: 'bubbleNode', position: { x: 330, y: 130 }, data: { name: 'Operating Rooms',         area_sqm: 700,  type: 'surgery',     color: '#7c3aed', size: sz(700),  zone: 'clinical',   description: '3 ORs + 1 procedure room, all with laminar flow' } },
  { id: 'endo',      type: 'bubbleNode', position: { x: 600, y: 200 }, data: { name: 'Endoscopy Suite',         area_sqm: 400,  type: 'surgery',     color: '#6d28d9', size: sz(400),  zone: 'clinical',   beds: 4,  description: '2 procedure rooms + 4 recovery bays' } },
  { id: 'imaging',   type: 'bubbleNode', position: { x: 80,  y: 460 }, data: { name: 'Imaging / Radiology',     area_sqm: 430,  type: 'radiology',   color: '#a78bfa', size: sz(430),  zone: 'diagnostic', description: 'X-ray, Ultrasound, portable CT' } },
  { id: 'lab',       type: 'bubbleNode', position: { x: 580, y: 430 }, data: { name: 'Point-of-Care Lab',       area_sqm: 180,  type: 'laboratory',  color: '#fbbf24', size: sz(180),  zone: 'diagnostic', description: 'Rapid testing, blood draw, urinalysis' } },
  { id: 'pharmacy',  type: 'bubbleNode', position: { x: 340, y: 280 }, data: { name: 'Pharmacy / Sterile Comp', area_sqm: 250,  type: 'pharmacy',    color: '#84cc16', size: sz(250),  zone: 'support',    description: 'IV compounding, dispensing window' } },
  { id: 'consult',   type: 'bubbleNode', position: { x: 130, y: 130 }, data: { name: 'Consultation Rooms',      area_sqm: 280,  type: 'outpatient',  color: '#10b981', size: sz(280),  zone: 'clinical',   description: '6 exam/consult rooms for pre- and post-procedure' } },
  { id: 'admin',     type: 'bubbleNode', position: { x: 590, y: 530 }, data: { name: 'Administration',          area_sqm: 200,  type: 'admin',       color: '#14b8a6', size: sz(200),  zone: 'admin',      description: 'Scheduling, billing, director office' } },
  { id: 'sterile',   type: 'bubbleNode', position: { x: 60,  y: 310 }, data: { name: 'Sterile Processing',      area_sqm: 230,  type: 'support',     color: '#6b7280', size: sz(230),  zone: 'service',    description: 'Central sterile supply, instrument reprocessing' } },
]

const d2Edges: SampleEdge[] = [
  req('preop', 'ors', '#8b5cf6'), req('ors', 'pharmacy', '#7c3aed'), req('sterile', 'ors', '#6b7280'),
  pref('reception', 'preop'), pref('reception', 'imaging'), pref('reception', 'lab'),
  pref('ors', 'endo', '#7c3aed'), pref('preop', 'consult', '#8b5cf6'),
  pref('lab', 'ors', '#fbbf24'), pref('imaging', 'preop', '#a78bfa'),
  pref('reception', 'admin'), pref('pharmacy', 'preop', '#84cc16'),
]

// ─── Diagram 3: Children's Hospital ─────────────────────────────────────────

const d3Nodes: SampleNode[] = [
  { id: 'ped_ed',    type: 'bubbleNode', position: { x: 30,  y: 380 }, data: { name: 'Pediatric ED',             area_sqm: 600,  type: 'emergency',  color: '#ef4444', size: sz(600),  zone: 'clinical',   beds: 18, description: '18 peds bays, trauma room, triage, family rooms' } },
  { id: 'nicu',      type: 'bubbleNode', position: { x: 50,  y: 130 }, data: { name: 'NICU Level III',           area_sqm: 900,  type: 'icu',        color: '#ec4899', size: sz(900),  zone: 'critical',   beds: 24, description: '24 private NICU rooms, family sleep-in capable' } },
  { id: 'picu',      type: 'bubbleNode', position: { x: 260, y: 100 }, data: { name: 'PICU',                     area_sqm: 720,  type: 'icu',        color: '#f472b6', size: sz(720),  zone: 'critical',   beds: 16, description: '16-bed pediatric ICU with family zones' } },
  { id: 'peds_surg', type: 'bubbleNode', position: { x: 490, y: 60  }, data: { name: 'Pediatric Surgery',        area_sqm: 750,  type: 'surgery',    color: '#8b5cf6', size: sz(750),  zone: 'clinical',   description: '3 ORs sized for peds equipment + neonatal OR' } },
  { id: 'inpatient', type: 'bubbleNode', position: { x: 680, y: 180 }, data: { name: 'Peds Med/Surg Inpatient',  area_sqm: 2600, type: 'inpatient',  color: '#3b82f6', size: sz(2600), zone: 'clinical',   beds: 80, description: '80 private rooms, family overnight accommodations' } },
  { id: 'oncology',  type: 'bubbleNode', position: { x: 700, y: 420 }, data: { name: 'Pediatric Oncology',       area_sqm: 900,  type: 'inpatient',  color: '#2563eb', size: sz(900),  zone: 'clinical',   beds: 24, description: '24 HEPA-filtered isolation rooms, infusion chairs' } },
  { id: 'radiology', type: 'bubbleNode', position: { x: 270, y: 290 }, data: { name: 'Peds Radiology',           area_sqm: 520,  type: 'radiology',  color: '#a78bfa', size: sz(520),  zone: 'diagnostic', description: 'MRI, CT, X-ray (all child-friendly environments)' } },
  { id: 'lab',       type: 'bubbleNode', position: { x: 480, y: 300 }, data: { name: 'Laboratory',               area_sqm: 320,  type: 'laboratory', color: '#fbbf24', size: sz(320),  zone: 'diagnostic', description: 'Core lab, pediatric specimen collection' } },
  { id: 'pharmacy',  type: 'bubbleNode', position: { x: 650, y: 330 }, data: { name: 'Pharmacy',                 area_sqm: 260,  type: 'pharmacy',   color: '#84cc16', size: sz(260),  zone: 'support',    description: 'Peds-specific dosing, IV compounding' } },
  { id: 'child_life',type: 'bubbleNode', position: { x: 450, y: 450 }, data: { name: 'Child Life & Play',        area_sqm: 380,  type: 'outpatient', color: '#10b981', size: sz(380),  zone: 'support',    description: 'Therapy rooms, playrooms, teen lounge' } },
  { id: 'lobby',     type: 'bubbleNode', position: { x: 240, y: 490 }, data: { name: 'Family Lobby & Support',   area_sqm: 500,  type: 'public',     color: '#f97316', size: sz(500),  zone: 'public',     description: 'Family resource center, chapel, café, guest services' } },
]

const d3Edges: SampleEdge[] = [
  req('ped_ed', 'picu', '#ef4444'), req('ped_ed', 'radiology', '#ef4444'),
  req('nicu', 'peds_surg', '#ec4899'), req('picu', 'peds_surg', '#f472b6'),
  req('peds_surg', 'picu', '#8b5cf6'), pref('nicu', 'picu', '#ec4899'),
  pref('picu', 'inpatient', '#f472b6'), pref('inpatient', 'radiology', '#3b82f6'),
  pref('radiology', 'lab', '#a78bfa'), pref('pharmacy', 'nicu', '#84cc16'),
  pref('pharmacy', 'oncology', '#84cc16'), pref('child_life', 'inpatient'),
  pref('lobby', 'child_life'), pref('lobby', 'ped_ed'),
  pref('inpatient', 'oncology', '#3b82f6'),
]

// ─── Diagram 4: Comprehensive Cancer Center ──────────────────────────────────

const d4Nodes: SampleNode[] = [
  { id: 'intake',    type: 'bubbleNode', position: { x: 50,  y: 380 }, data: { name: 'Intake & Navigation',      area_sqm: 280,  type: 'public',     color: '#f97316', size: sz(280),  zone: 'public',     description: 'Nurse navigators, social work, initial consults' } },
  { id: 'imaging',   type: 'bubbleNode', position: { x: 50,  y: 190 }, data: { name: 'Diagnostic Imaging',       area_sqm: 680,  type: 'radiology',  color: '#a78bfa', size: sz(680),  zone: 'diagnostic', description: 'PET-CT, MRI, mammography, ultrasound, biopsy suites' } },
  { id: 'path_lab',  type: 'bubbleNode', position: { x: 250, y: 90  }, data: { name: 'Pathology & Lab',          area_sqm: 500,  type: 'laboratory', color: '#fbbf24', size: sz(500),  zone: 'diagnostic', description: 'Anatomic pathology, molecular diagnostics, blood bank' } },
  { id: 'tumor_board',type:'bubbleNode', position: { x: 430, y: 100 }, data: { name: 'MDT Conference Center',    area_sqm: 220,  type: 'admin',      color: '#14b8a6', size: sz(220),  zone: 'clinical',   description: 'Multidisciplinary tumor board rooms, teleconference' } },
  { id: 'med_onco',  type: 'bubbleNode', position: { x: 270, y: 280 }, data: { name: 'Medical Oncology',         area_sqm: 900,  type: 'outpatient', color: '#10b981', size: sz(900),  zone: 'treatment',  description: 'Infusion center (30 chairs), consult rooms, oncology nursing' } },
  { id: 'rad_onco',  type: 'bubbleNode', position: { x: 560, y: 250 }, data: { name: 'Radiation Oncology',       area_sqm: 1100, type: 'radiology',  color: '#7c3aed', size: sz(1100), zone: 'treatment',  description: '2 linear accelerators, sim room, treatment planning, dosimetry' } },
  { id: 'surg_onco', type: 'bubbleNode', position: { x: 650, y: 80  }, data: { name: 'Surgical Oncology',        area_sqm: 850,  type: 'surgery',    color: '#8b5cf6', size: sz(850),  zone: 'clinical',   description: '3 ORs (da Vinci compatible), PACU, surgical consult' } },
  { id: 'inpatient', type: 'bubbleNode', position: { x: 740, y: 340 }, data: { name: 'Inpatient Oncology',       area_sqm: 1400, type: 'inpatient',  color: '#3b82f6', size: sz(1400), zone: 'clinical',   beds: 40, description: '40 HEPA-filtered private rooms, bone marrow transplant unit' } },
  { id: 'pharmacy',  type: 'bubbleNode', position: { x: 430, y: 300 }, data: { name: 'Oncology Pharmacy',        area_sqm: 320,  type: 'pharmacy',   color: '#84cc16', size: sz(320),  zone: 'support',    description: 'Hazardous drug compounding, chemo preparation, clinical pharmacist' } },
  { id: 'palliative',type: 'bubbleNode', position: { x: 520, y: 460 }, data: { name: 'Palliative & Supportive',  area_sqm: 450,  type: 'support',    color: '#6b7280', size: sz(450),  zone: 'support',    description: 'Palliative consult, pain management, spiritual care, social work' } },
  { id: 'research',  type: 'bubbleNode', position: { x: 260, y: 490 }, data: { name: 'Research & Clinical Trials',area_sqm:580,  type: 'admin',      color: '#0ea5e9', size: sz(580),  zone: 'research',   description: 'Phase I-III trial coordination, research nursing, data management' } },
  { id: 'support',   type: 'bubbleNode', position: { x: 90,  y: 510 }, data: { name: 'Wellness & Support',       area_sqm: 380,  type: 'outpatient', color: '#f59e0b', size: sz(380),  zone: 'support',    description: 'Integrative oncology, counseling, nutrition, exercise therapy' } },
]

const d4Edges: SampleEdge[] = [
  req('imaging', 'path_lab', '#a78bfa'), req('path_lab', 'tumor_board', '#fbbf24'),
  req('med_onco', 'pharmacy', '#10b981'), req('rad_onco', 'imaging', '#7c3aed'),
  pref('intake', 'med_onco'), pref('intake', 'imaging'), pref('intake', 'support'),
  pref('tumor_board', 'med_onco', '#14b8a6'), pref('tumor_board', 'rad_onco', '#14b8a6'),
  pref('tumor_board', 'surg_onco', '#14b8a6'), pref('surg_onco', 'inpatient', '#8b5cf6'),
  pref('med_onco', 'inpatient', '#10b981'), pref('pharmacy', 'inpatient', '#84cc16'),
  pref('palliative', 'inpatient'), pref('research', 'med_onco'),
  pref('support', 'med_onco'), pref('palliative', 'support'),
]

// ─── Export ───────────────────────────────────────────────────────────────────

export const SAMPLE_DIAGRAMS: SampleDiagram[] = [
  {
    id: 'community-hospital',
    title: '100-Bed Community Hospital',
    prompt: '100-bed community hospital with emergency department, ICU, surgery, medical-surgical inpatient, radiology, lab, pharmacy, and outpatient clinics',
    description: 'Full-service acute care hospital with emergency and surgical capabilities',
    tags: ['Acute Care', '100 beds', '~7,230 sqm'],
    nodes: d1Nodes,
    edges: d1Edges,
    program_data: {
      departments: d1Nodes.map(n => ({ id: n.id, name: n.data.name, area_sqm: n.data.area_sqm, type: n.data.type, color: n.data.color, zone: n.data.zone, beds: n.data.beds, description: n.data.description })),
      total_area_sqm: 7230,
      total_beds: 100,
      summary: 'A compact full-service community hospital organized around a diagnostic core, with direct emergency-to-imaging and ED-to-OR connections. Inpatient tower positioned adjacent to surgery and ICU for efficient patient flow.',
    },
  },
  {
    id: 'ambulatory-surgery',
    title: 'Ambulatory Surgery Center',
    prompt: 'Ambulatory surgery center with 3 ORs, endoscopy suite, pre-op/PACU, imaging, point-of-care lab, pharmacy, sterile processing, and consultation rooms',
    description: 'Outpatient surgical facility with integrated diagnostic services',
    tags: ['Outpatient', 'ASC', '~4,060 sqm'],
    nodes: d2Nodes,
    edges: d2Edges,
    program_data: {
      departments: d2Nodes.map(n => ({ id: n.id, name: n.data.name, area_sqm: n.data.area_sqm, type: n.data.type, color: n.data.color, zone: n.data.zone, beds: n.data.beds, description: n.data.description })),
      total_area_sqm: 4060,
      total_beds: 16,
      summary: 'Compact ambulatory surgery center with a clean sterile-processing workflow loop and direct pre-op to OR adjacency. Endoscopy runs semi-independently with shared pharmacy and lab.',
    },
  },
  {
    id: 'childrens-hospital',
    title: "200-Bed Children's Hospital",
    prompt: "200-bed children's hospital with NICU Level III, PICU, pediatric emergency, inpatient, pediatric surgery, oncology unit, radiology, child life, and family support",
    description: "Full pediatric hospital with critical care and family-centered design",
    tags: ["Pediatric", "200 beds", "~8,350 sqm"],
    nodes: d3Nodes,
    edges: d3Edges,
    program_data: {
      departments: d3Nodes.map(n => ({ id: n.id, name: n.data.name, area_sqm: n.data.area_sqm, type: n.data.type, color: n.data.color, zone: n.data.zone, beds: n.data.beds, description: n.data.description })),
      total_area_sqm: 8350,
      total_beds: 200,
      summary: "Family-centered pediatric hospital clustered by acuity. NICU and PICU occupy a dedicated critical zone with direct OR access. Child life and family support spaces integrated throughout clinical areas to reduce stress for patients and families.",
    },
  },
  {
    id: 'cancer-center',
    title: 'Comprehensive Cancer Center',
    prompt: 'NCI-designated comprehensive cancer center with diagnostic imaging, pathology, multidisciplinary tumor board, medical oncology with infusion, radiation oncology with linear accelerators, surgical oncology, inpatient oncology, and research',
    description: 'NCI-designated cancer center with full treatment and research capabilities',
    tags: ['Oncology', 'Research', '~7,860 sqm'],
    nodes: d4Nodes,
    edges: d4Edges,
    program_data: {
      departments: d4Nodes.map(n => ({ id: n.id, name: n.data.name, area_sqm: n.data.area_sqm, type: n.data.type, color: n.data.color, zone: n.data.zone, beds: n.data.beds, description: n.data.description })),
      total_area_sqm: 7860,
      total_beds: 40,
      summary: "Workflow-driven cancer center organized around the multidisciplinary tumor board as the clinical decision hub. Diagnostic, treatment, and support zones flow logically from patient intake through navigation to active treatment and survivorship.",
    },
  },
]
