import type { Department } from '../../store/collabStore'

interface Props {
  departments: Department[]
}

interface Floor {
  label: string
  sublabel: string
  depts: Department[]
  bgClass: string
}

const ZONE_FLOOR_PRIORITY: Record<string, number> = {
  service: -1,
  public: 0,
  admin: 0,
  diagnostic: 1,
  emergency: 1,
  outpatient: 1,
  pharmacy: 1,
  laboratory: 1,
  radiology: 1,
  surgery: 2,
  icu: 2,
  clinical: 3,
  inpatient: 3,
}

const TYPE_FLOOR: Record<string, number> = {
  support: -1,
  public: 0,
  admin: 0,
  pharmacy: 1,
  laboratory: 1,
  radiology: 1,
  outpatient: 1,
  emergency: 1,
  imaging: 1,
  diagnostic: 1,
  surgery: 2,
  icu: 2,
  rehabilitation: 2,
  inpatient: 3,
  clinical: 3,
}

function assignFloor(dept: Department): number {
  const byType = TYPE_FLOOR[dept.type]
  if (byType !== undefined) return byType
  const byZone = ZONE_FLOOR_PRIORITY[dept.zone || '']
  if (byZone !== undefined) return byZone
  return 1
}

const FLOOR_META: Record<number, { label: string; sublabel: string; bgClass: string }> = {
  '-1': { label: 'Basement',  sublabel: 'Service / Support / Loading / Mechanical', bgClass: 'bg-slate-500/20' },
  0:    { label: 'Floor 1',   sublabel: 'Public / Emergency / Admin',                bgClass: 'bg-orange-500/20' },
  1:    { label: 'Floor 2',   sublabel: 'Diagnostic / Outpatient / Pharmacy',        bgClass: 'bg-yellow-500/15' },
  2:    { label: 'Floor 3',   sublabel: 'Surgery / ICU / Step-Down',                 bgClass: 'bg-purple-500/20' },
  3:    { label: 'Floor 4',   sublabel: 'Inpatient Units',                           bgClass: 'bg-blue-500/20' },
}

const MECHANICAL_FLOOR: Floor = {
  label: 'Roof / Mech',
  sublabel: 'Mechanical / HVAC',
  depts: [],
  bgClass: 'bg-slate-600/15',
}

export default function StackingDiagram({ departments }: Props) {
  if (departments.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        Generate diagrams from the chat panel to see the stacking diagram.
      </div>
    )
  }

  const byFloor = new Map<number, Department[]>()
  for (const d of departments) {
    const f = assignFloor(d)
    if (!byFloor.has(f)) byFloor.set(f, [])
    byFloor.get(f)!.push(d)
  }

  const floorNums = Array.from(byFloor.keys()).sort((a, b) => b - a)
  const floors: Floor[] = floorNums.map(n => ({
    ...FLOOR_META[n] ?? { label: `Floor ${n}`, sublabel: '', bgClass: 'bg-card' },
    depts: byFloor.get(n) || [],
  }))

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-none px-5 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-white">Blocking / Stacking Diagram</h3>
        <p className="text-xs text-muted mt-0.5">Shows how major departments are stacked vertically in the building</p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="flex gap-8">
          {/* Building cross-section */}
          <div className="flex-1 min-w-0">
            {/* Roof/Mech */}
            <div className={`${MECHANICAL_FLOOR.bgClass} border border-border rounded-t-xl px-4 py-3 flex items-center justify-between mb-0.5`}>
              <div>
                <div className="text-xs font-semibold text-white">{MECHANICAL_FLOOR.label}</div>
                <div className="text-xs text-muted">{MECHANICAL_FLOOR.sublabel}</div>
              </div>
              <div className="text-xs text-muted italic">Mechanical</div>
            </div>

            {/* Floors stacked top to bottom */}
            {floors.map((floor, i) => (
              <div
                key={floor.label}
                className={`${floor.bgClass} border-x border-b border-border px-4 py-3 ${i === floors.length - 1 ? 'rounded-b-xl' : ''} mb-0.5`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-none w-20">
                    <div className="text-xs font-bold text-white">{floor.label}</div>
                    <div className="text-xs text-muted leading-tight mt-0.5">{floor.sublabel}</div>
                  </div>
                  <div className="flex-1 flex flex-wrap gap-1.5">
                    {floor.depts.map(d => (
                      <div
                        key={d.id}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium"
                        style={{
                          borderColor: `${d.color}40`,
                          backgroundColor: `${d.color}15`,
                          color: d.color,
                        }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: d.color }} />
                        {d.name}
                        {d.area_sqm ? (
                          <span className="text-muted font-normal ml-0.5">{Math.round(d.area_sqm / 93).toLocaleString()} NSF</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {/* Vertical circulation indicator */}
            <div className="mt-4 flex items-center gap-2 text-xs text-muted">
              <div className="w-4 h-16 border-2 border-dashed border-accent/40 rounded flex items-center justify-center">
                <div className="text-accent rotate-90 text-xs">↕</div>
              </div>
              <span>Vertical Circulation (Elevators / Stairs)</span>
            </div>
          </div>

          {/* Floor legend */}
          <div className="w-44 flex-none">
            <p className="text-xs font-medium text-muted uppercase tracking-wider mb-3">Floor Plan</p>
            <div className="space-y-2">
              {[MECHANICAL_FLOOR, ...floors].map(floor => (
                <div key={floor.label} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-sm border border-border ${floor.bgClass}`} />
                  <div>
                    <div className="text-xs font-medium text-white">{floor.label}</div>
                    <div className="text-xs text-muted leading-tight">{floor.depts.map(d => d.name.split(' ')[0]).join(', ') || 'Mechanical'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
