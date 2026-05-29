import type { Department } from '../../store/collabStore'

interface Props {
  departments: Department[]
}

interface Room {
  dept: Department
  x: number
  y: number
  w: number
  h: number
}

function layoutRooms(departments: Department[]): Room[] {
  if (departments.length === 0) return []

  const totalArea = departments.reduce((s, d) => s + (d.area_sqm || 500), 0)
  const scale = 3200 / totalArea

  // Sort: public first, then clinical, then support, then service
  const ORDER: Record<string, number> = { public: 0, admin: 1, clinical: 2, diagnostic: 2, emergency: 2, outpatient: 2, pharmacy: 2, surgery: 3, icu: 3, inpatient: 4, support: 5, service: 6 }
  const sorted = [...departments].sort((a, b) =>
    (ORDER[a.type] ?? 5) - (ORDER[b.type] ?? 5)
  )

  const cols = Math.ceil(Math.sqrt(sorted.length))
  const cellW = 520 / cols
  const rooms: Room[] = []
  let maxRow = 0

  sorted.forEach((dept, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const area = (dept.area_sqm || 500) * scale
    const w = Math.max(60, Math.min(cellW - 8, Math.sqrt(area) * 1.4))
    const h = Math.max(40, area / Math.max(40, w))
    rooms.push({ dept, x: col * cellW + 4, y: row * 80 + 4, w: Math.round(w), h: Math.round(h) })
    maxRow = Math.max(maxRow, row)
  })

  return rooms
}

const ZONE_LABELS: Record<string, string> = {
  public: 'Public',
  clinical: 'Clinical',
  diagnostic: 'Clinical',
  support: 'Support',
  service: 'Service',
  admin: 'Support',
}

const ZONE_BG_CLASS: Record<string, string> = {
  public: 'bg-orange-500/20',
  clinical: 'bg-red-500/15',
  diagnostic: 'bg-purple-500/15',
  support: 'bg-blue-500/10',
  service: 'bg-slate-500/15',
  admin: 'bg-teal-500/10',
}

export default function FloorPlan({ departments }: Props) {
  if (departments.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        Generate diagrams from the chat panel to see the schematic floor plan.
      </div>
    )
  }

  const rooms = layoutRooms(departments)
  const svgH = Math.max(300, rooms.reduce((m, r) => Math.max(m, r.y + r.h + 20), 0))

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-none px-5 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-white">Schematic Floor Plan (Early)</h3>
        <p className="text-xs text-muted mt-0.5">First rough plan showing how spaces and circulation start to fit together</p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="flex gap-8">
          <div className="flex-1">
            {/* Floor boundary */}
            <div className="relative rounded-xl border-2 border-dashed border-border/60 bg-surface/50 p-2">
              {/* Circulation indicators */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 opacity-50">
                <div className="text-xs text-muted rotate-90 whitespace-nowrap">Elev / Stairs</div>
                <div className="w-8 h-32 border-2 border-dashed border-accent/40 rounded" />
              </div>

              {/* Loading dock indicator */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-50">
                <div className="w-20 h-5 border border-dashed border-emerald-500/40 rounded-sm flex items-center justify-center">
                  <span className="text-xs text-emerald-400">Loading</span>
                </div>
                <div className="text-xs text-muted">↓</div>
              </div>

              <svg width={540} height={svgH + 40} className="overflow-visible">
                {rooms.map(({ dept, x, y, w, h }) => (
                  <g key={dept.id}>
                    <rect
                      x={x} y={y} width={w} height={h} rx={4}
                      fill={`${dept.color}20`} stroke={`${dept.color}50`} strokeWidth={1.5}
                    />
                    <text x={x + w / 2} y={y + h / 2 - 4} textAnchor="middle" fontSize={9} fill={dept.color} fontWeight={600}>
                      {dept.name.split(' ').slice(0, 2).join(' ')}
                    </text>
                    <text x={x + w / 2} y={y + h / 2 + 8} textAnchor="middle" fontSize={8} fill={`${dept.color}90`}>
                      {dept.area_sqm?.toLocaleString()} m²
                    </text>
                  </g>
                ))}

                {/* Circulation arrows */}
                <line x1={270} y1={0} x2={270} y2={svgH + 20} stroke="#4f6ef780" strokeWidth={1} strokeDasharray="4,4" />
                <line x1={0} y1={svgH / 2} x2={540} y2={svgH / 2} stroke="#4f6ef720" strokeWidth={1} strokeDasharray="4,4" />
              </svg>
            </div>
          </div>

          {/* Legend */}
          <div className="w-36 flex-none">
            <p className="text-xs font-medium text-muted uppercase tracking-wider mb-3">Zone Legend</p>
            {Object.entries(ZONE_LABELS).map(([zone, label]) => (
              <div key={zone} className="flex items-center gap-2 mb-2">
                <div className={`w-4 h-4 rounded-sm border border-border ${ZONE_BG_CLASS[zone] || 'bg-card'}`} />
                <span className="text-xs text-muted">{label}</span>
              </div>
            ))}

            <div className="border-t border-border mt-4 pt-4">
              <p className="text-xs font-medium text-muted uppercase tracking-wider mb-3">Circulation</p>
              {[
                { color: '#4f6ef7', label: 'Public Circ.' },
                { color: '#ef4444', label: 'Clinical Circ.' },
                { color: '#10b981', label: 'Service Circ.' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-0.5">
                    <div className="w-4 h-0.5 rounded" style={{ backgroundColor: color }} />
                    <div className="text-xs" style={{ color }}>→</div>
                  </div>
                  <span className="text-xs text-muted">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
