import { useState } from 'react'
import {
  GripVertical, ChevronUp, ChevronDown, Plus, Minus, MousePointer2,
} from 'lucide-react'
import type { Department } from '../../store/collabStore'

interface Props {
  departments: Department[]
}

// ─── Floor assignment ─────────────────────────────────────────────────────────

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
  return TYPE_FLOOR[dept.type] ?? TYPE_FLOOR[dept.zone || ''] ?? 1
}

const FLOOR_META: Record<number, { label: string; sublabel: string; color: string }> = {
  '-1': { label: 'Basement',  sublabel: 'Service / Support / Loading', color: '#64748b' },
  0:    { label: 'Floor 1',   sublabel: 'Public / Emergency / Admin',  color: '#f97316' },
  1:    { label: 'Floor 2',   sublabel: 'Diagnostic / Outpatient',     color: '#eab308' },
  2:    { label: 'Floor 3',   sublabel: 'Surgery / ICU',               color: '#a855f7' },
  3:    { label: 'Floor 4',   sublabel: 'Inpatient Units',             color: '#3b82f6' },
  4:    { label: 'Floor 5',   sublabel: 'Upper Inpatient',             color: '#06b6d4' },
  5:    { label: 'Floor 6',   sublabel: 'Administrative / Support',    color: '#84cc16' },
}

function floorMeta(n: number) {
  return FLOOR_META[n] ?? { label: `Floor ${n > 0 ? n + 1 : n}`, sublabel: '', color: '#6b7280' }
}

// ─── Tool button ──────────────────────────────────────────────────────────────

type StackTool = 'select' | 'move'

const ToolBtn = ({ icon: Icon, label, active, onClick }: {
  icon: React.ElementType; label: string; active: boolean; onClick: () => void
}) => (
  <button
    title={label}
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
      active
        ? 'border-accent/50 bg-accent/15 text-accent'
        : 'border-border text-muted hover:text-white hover:border-accent/30'
    }`}
  >
    <Icon size={13} />
    {label}
  </button>
)

// ─── Main component ────────────────────────────────────────────────────────────

export default function StackingDiagram({ departments }: Props) {
  const [tool, setTool] = useState<StackTool>('select')
  const [selectedDept, setSelectedDept] = useState<string | null>(null)
  const [floorOverrides, setFloorOverrides] = useState<Record<string, number>>({})
  const [extraFloors, setExtraFloors] = useState<number[]>([])
  const [dragOver, setDragOver] = useState<number | null>(null)

  if (departments.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        Generate diagrams from the chat panel to see the stacking diagram.
      </div>
    )
  }

  const getFloor = (d: Department) => floorOverrides[d.id] ?? assignFloor(d)

  // Collect all used floor numbers + any manually added
  const usedFloors = new Set([...departments.map(getFloor), ...extraFloors])
  const allFloors = Array.from(usedFloors).sort((a, b) => b - a) // top-to-bottom

  const byFloor = new Map<number, Department[]>()
  for (const f of allFloors) byFloor.set(f, [])
  for (const d of departments) {
    const f = getFloor(d)
    byFloor.get(f)?.push(d)
  }

  const selectedDeptObj = departments.find(d => d.id === selectedDept) ?? null

  // ── Move selected dept up/down one floor ──────────────────────────────────────
  const moveSelected = (dir: 1 | -1) => {
    if (!selectedDept) return
    const d = departments.find(x => x.id === selectedDept)!
    const cur = getFloor(d)
    const next = cur + dir
    setFloorOverrides(prev => ({ ...prev, [selectedDept]: next }))
    // auto-create floor if needed
    if (!usedFloors.has(next)) setExtraFloors(prev => [...prev, next])
  }

  // ── Drag-and-drop ─────────────────────────────────────────────────────────────
  const onDragStart = (e: React.DragEvent, deptId: string) => {
    e.dataTransfer.setData('deptId', deptId)
    setSelectedDept(deptId)
  }

  const onDrop = (e: React.DragEvent, floorNum: number) => {
    e.preventDefault()
    const deptId = e.dataTransfer.getData('deptId')
    if (!deptId) return
    setFloorOverrides(prev => ({ ...prev, [deptId]: floorNum }))
    setDragOver(null)
  }

  const onDragOver = (e: React.DragEvent, floorNum: number) => {
    e.preventDefault()
    setDragOver(floorNum)
  }

  // ── Add/remove floors ─────────────────────────────────────────────────────────
  const addFloorAbove = () => {
    const top = Math.max(...allFloors)
    const next = top + 1
    setExtraFloors(prev => [...prev, next])
  }

  const removeEmptyFloor = (f: number) => {
    if ((byFloor.get(f) ?? []).length > 0) return
    setExtraFloors(prev => prev.filter(x => x !== f))
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Header + toolbar */}
      <div className="flex-none px-5 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-white">Blocking / Stacking Diagram</h3>
        <p className="text-xs text-muted mt-0.5">Drag departments between floors or use the tools below</p>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <ToolBtn icon={MousePointer2} label="Select"    active={tool === 'select'} onClick={() => setTool('select')} />
          <ToolBtn icon={GripVertical}  label="Drag Move" active={tool === 'move'}   onClick={() => setTool('move')} />

          <div className="w-px h-5 bg-border mx-1" />

          {/* Move selected dept up/down */}
          <button
            title="Move selected department up one floor"
            disabled={!selectedDept}
            onClick={() => moveSelected(1)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted hover:text-white hover:border-accent/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronUp size={13} /> Up Floor
          </button>
          <button
            title="Move selected department down one floor"
            disabled={!selectedDept}
            onClick={() => moveSelected(-1)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted hover:text-white hover:border-accent/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronDown size={13} /> Down Floor
          </button>

          <div className="w-px h-5 bg-border mx-1" />

          <button
            title="Add floor above current top floor"
            onClick={addFloorAbove}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted hover:text-white hover:border-accent/30 transition-all"
          >
            <Plus size={13} /> Add Floor
          </button>

          {selectedDept && (
            <span className="ml-auto text-xs text-accent">
              Selected: <span className="font-semibold text-white">{selectedDeptObj?.name}</span>
              <span className="text-muted ml-1">(Floor {getFloor(selectedDeptObj!)}</span>
              <span className="text-muted">)</span>
            </span>
          )}
        </div>
      </div>

      {/* Stacking view */}
      <div className="flex-1 overflow-auto p-6">
        <div className="flex gap-8">

          {/* Building cross-section */}
          <div className="flex-1 min-w-0 space-y-1">
            {/* Roof / Mech */}
            <div className="bg-slate-600/15 border border-border rounded-t-xl px-4 py-2.5 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white">Roof / Mech</div>
                <div className="text-xs text-muted">Mechanical / HVAC / Plant</div>
              </div>
              <div className="text-xs text-muted italic">Mechanical</div>
            </div>

            {allFloors.map((floorNum, i) => {
              const meta = floorMeta(floorNum)
              const depts = byFloor.get(floorNum) ?? []
              const isLast = i === allFloors.length - 1
              const isOver = dragOver === floorNum

              return (
                <div
                  key={floorNum}
                  onDrop={e => onDrop(e, floorNum)}
                  onDragOver={e => onDragOver(e, floorNum)}
                  onDragLeave={() => setDragOver(null)}
                  style={{ borderColor: isOver ? meta.color + '60' : undefined }}
                  className={`border-x border-b border-border px-4 py-3 transition-colors ${
                    isLast ? 'rounded-b-xl' : ''
                  } ${isOver ? 'bg-accent/5' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Floor label */}
                    <div className="flex-none w-20">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-sm flex-none" style={{ background: meta.color }} />
                        <div className="text-xs font-bold text-white">{meta.label}</div>
                        {depts.length === 0 && (
                          <button
                            onClick={() => removeEmptyFloor(floorNum)}
                            title="Remove empty floor"
                            className="ml-auto text-muted hover:text-red-400 transition-colors"
                          >
                            <Minus size={11} />
                          </button>
                        )}
                      </div>
                      <div className="text-xs text-muted leading-tight mt-0.5 pl-3.5">{meta.sublabel}</div>
                    </div>

                    {/* Departments */}
                    <div className="flex-1 flex flex-wrap gap-1.5 min-h-[28px]">
                      {depts.map(dept => {
                        const isSel = selectedDept === dept.id
                        return (
                          <div
                            key={dept.id}
                            draggable={tool === 'move'}
                            onDragStart={e => onDragStart(e, dept.id)}
                            onClick={() => {
                              if (tool === 'select') setSelectedDept(isSel ? null : dept.id)
                            }}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all select-none ${
                              tool === 'move' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                            }`}
                            style={{
                              borderColor: isSel ? dept.color : `${dept.color}40`,
                              backgroundColor: isSel ? `${dept.color}30` : `${dept.color}15`,
                              color: dept.color,
                              boxShadow: isSel ? `0 0 0 1.5px ${dept.color}66` : 'none',
                            }}
                          >
                            {tool === 'move' && <GripVertical size={10} className="opacity-50 flex-none" />}
                            <div className="w-1.5 h-1.5 rounded-full flex-none" style={{ backgroundColor: dept.color }} />
                            {dept.name}
                            {dept.area_sqm ? (
                              <span className="text-muted font-normal ml-0.5">{Math.round(dept.area_sqm / 93).toLocaleString()} NSF</span>
                            ) : null}
                          </div>
                        )
                      })}
                      {depts.length === 0 && (
                        <div className="text-xs text-muted/40 italic">Drop departments here</div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Vertical circulation */}
            <div className="mt-4 flex items-center gap-2 text-xs text-muted">
              <div className="w-4 h-16 border-2 border-dashed border-accent/40 rounded flex items-center justify-center">
                <span className="text-accent rotate-90 text-xs">↕</span>
              </div>
              <span>Vertical Circulation — Elevators / Stairs / Shafts</span>
            </div>
          </div>

          {/* Legend sidebar */}
          <div className="w-44 flex-none space-y-3">
            <div>
              <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">Floor Key</p>
              <div className="space-y-1.5">
                {['Roof / Mech', ...allFloors.map(f => floorMeta(f).label)].map((label, i) => {
                  const color = i === 0 ? '#475569' : floorMeta(allFloors[i - 1]).color
                  return (
                    <div key={label} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm flex-none" style={{ background: color + '40', border: `1px solid ${color}60` }} />
                      <span className="text-xs text-white">{label}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">Tools</p>
              <div className="space-y-1 text-xs text-muted">
                <div><span className="text-white">Select</span> — click to pick dept</div>
                <div><span className="text-white">Drag Move</span> — drag between floors</div>
                <div><span className="text-white">Up/Down</span> — move selected dept</div>
                <div><span className="text-white">Add Floor</span> — add empty floor</div>
                <div><span className="text-white">− button</span> — remove empty floor</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
