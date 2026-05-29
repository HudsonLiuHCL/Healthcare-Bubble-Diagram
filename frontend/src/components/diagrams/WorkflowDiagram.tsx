import type { Department } from '../../store/collabStore'

interface Props {
  departments: Department[]
}

interface FlowNode {
  id: string
  label: string
  color: string
  x: number
  y: number
  w: number
  h: number
}

interface FlowEdge {
  from: string
  to: string
  type: 'patient' | 'staff' | 'supply'
  label?: string
}

const FLOW_COLORS = {
  patient: '#ef4444',
  staff:   '#4f6ef7',
  supply:  '#10b981',
}

const ZONE_COLORS: Record<string, string> = {
  public:     '#f97316',
  clinical:   '#ef4444',
  diagnostic: '#a78bfa',
  support:    '#6b7280',
  service:    '#374151',
  admin:      '#14b8a6',
  emergency:  '#ef4444',
}

function buildFlow(departments: Department[]): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const depts = departments.slice(0, 8)

  const pubDepts  = depts.filter(d => d.zone === 'public' || d.type === 'public')
  const emergDepts = depts.filter(d => d.type === 'emergency')
  const diagDepts  = depts.filter(d => d.zone === 'diagnostic' || d.type === 'radiology' || d.type === 'laboratory')
  const surgDepts  = depts.filter(d => d.type === 'surgery')
  const icuDepts   = depts.filter(d => d.type === 'icu')
  const inpDepts   = depts.filter(d => d.type === 'inpatient' || d.zone === 'clinical')
  const servDepts  = depts.filter(d => d.zone === 'service' || d.type === 'support')

  const nodes: FlowNode[] = []
  const edges: FlowEdge[] = []
  let y = 30

  const addNode = (dept: Department, nx: number, ny: number, nw = 140, nh = 44): FlowNode => {
    const n: FlowNode = { id: dept.id, label: dept.name, color: dept.color || ZONE_COLORS[dept.zone || ''] || '#6b7280', x: nx, y: ny, w: nw, h: nh }
    nodes.push(n)
    return n
  }

  const simpleNode = (id: string, label: string, color: string, nx: number, ny: number, nw = 140, nh = 44): FlowNode => {
    const n: FlowNode = { id, label, color, x: nx, y: ny, w: nw, h: nh }
    nodes.push(n)
    return n
  }

  // Public entry
  const entry = simpleNode('entry', 'Public Lobby / Entry', '#f97316', 200, y)
  y += 90

  // Row: Emergency + Outpatient
  const outDepts = depts.filter(d => d.type === 'outpatient')
  if (emergDepts[0]) addNode(emergDepts[0], 60, y)
  if (outDepts[0]) addNode(outDepts[0], 340, y)
  y += 90

  // Row: Imaging / Lab
  if (diagDepts[0]) addNode(diagDepts[0], 60, y)
  if (diagDepts[1]) addNode(diagDepts[1], 220, y)
  y += 90

  // Row: Surgery + ICU
  if (surgDepts[0]) addNode(surgDepts[0], 60, y)
  if (icuDepts[0]) addNode(icuDepts[0], 220, y)
  y += 90

  // Row: Inpatient
  if (inpDepts[0]) addNode(inpDepts[0], 180, y, 160)
  y += 90

  // Service / Support
  if (servDepts[0]) addNode(servDepts[0], 180, y, 160)

  // Edges
  if (emergDepts[0]) {
    edges.push({ from: 'entry', to: emergDepts[0].id, type: 'patient' })
    edges.push({ from: 'entry', to: emergDepts[0].id, type: 'staff' })
  }
  if (outDepts[0]) edges.push({ from: 'entry', to: outDepts[0].id, type: 'patient' })
  if (diagDepts[0] && emergDepts[0]) edges.push({ from: emergDepts[0].id, to: diagDepts[0].id, type: 'patient' })
  if (diagDepts[0] && surgDepts[0]) edges.push({ from: diagDepts[0].id, to: surgDepts[0].id, type: 'patient' })
  if (surgDepts[0] && icuDepts[0]) edges.push({ from: surgDepts[0].id, to: icuDepts[0].id, type: 'patient' })
  if (icuDepts[0] && inpDepts[0]) edges.push({ from: icuDepts[0].id, to: inpDepts[0].id, type: 'patient' })
  if (inpDepts[0] && servDepts[0]) edges.push({ from: inpDepts[0].id, to: servDepts[0].id, type: 'supply' })

  return { nodes, edges }
}

export default function WorkflowDiagram({ departments }: Props) {
  if (departments.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        Generate diagrams from the chat panel to see the workflow diagram.
      </div>
    )
  }

  const { nodes } = buildFlow(departments)

  const svgW = 540
  const svgH = Math.max(500, nodes.reduce((m, n) => Math.max(m, n.y + n.h + 40), 0))

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-none px-5 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-white">Workflow Diagram</h3>
        <p className="text-xs text-muted mt-0.5">Shows how patients, staff, and materials move through departments</p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="flex gap-8">
          <div className="flex-1">
            <svg width={svgW} height={svgH} className="overflow-visible">
              <defs>
                {(['patient', 'staff', 'supply'] as const).map(t => (
                  <marker key={t} id={`arrow-${t}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L8,3 z" fill={FLOW_COLORS[t]} opacity={0.8} />
                  </marker>
                ))}
              </defs>

              {/* Render nodes */}
              {nodes.map(n => (
                <g key={n.id}>
                  <rect
                    x={n.x} y={n.y} width={n.w} height={n.h} rx={8}
                    fill={`${n.color}18`} stroke={`${n.color}60`} strokeWidth={1.5}
                  />
                  <text x={n.x + n.w / 2} y={n.y + n.h / 2 + 4} textAnchor="middle"
                    fontSize={11} fill={n.color} fontWeight={500}>
                    {n.label.length > 18 ? n.label.split(' ').slice(0, 2).join(' ') : n.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          {/* Legend */}
          <div className="w-44 flex-none">
            <p className="text-xs font-medium text-muted uppercase tracking-wider mb-3">Legend</p>
            <div className="space-y-3">
              {(['patient', 'staff', 'supply'] as const).map(t => (
                <div key={t} className="flex items-center gap-2">
                  <div className="w-8 h-0.5 rounded" style={{ backgroundColor: FLOW_COLORS[t] }} />
                  <span className="text-xs text-white capitalize">{t} Flow</span>
                </div>
              ))}
              <div className="border-t border-border pt-3 mt-2">
                <p className="text-xs text-muted uppercase tracking-wider mb-2">Zones</p>
                {[
                  ['Public', '#f97316'],
                  ['Clinical', '#ef4444'],
                  ['Diagnostic', '#a78bfa'],
                  ['Support', '#6b7280'],
                  ['Service', '#4b5563'],
                ].map(([label, color]) => (
                  <div key={label} className="flex items-center gap-2 mb-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color + '30', border: `1px solid ${color}60` }} />
                    <span className="text-xs text-muted">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
