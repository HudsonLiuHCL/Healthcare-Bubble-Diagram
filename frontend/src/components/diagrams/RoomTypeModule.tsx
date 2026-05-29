import { useState } from 'react'
import type { Department } from '../../store/collabStore'

interface Props {
  departments: Department[]
}

type RoomType = 'icu' | 'trauma' | 'or'

interface RoomConfig {
  id: RoomType
  name: string
  subtitle: string
  color: string
  sqft: string
  zones: { label: string; color: string }[]
  legend: { num: number; label: string; type: string }[]
}

const ROOMS: RoomConfig[] = [
  {
    id: 'icu',
    name: 'ICU Patient Room',
    subtitle: 'Typical layout — 280–320 SF per bed',
    color: '#ec4899',
    sqft: '280–320 SF',
    zones: [
      { label: 'Nurse Work Area (360° Visibility)', color: '#4f6ef740' },
      { label: 'Family Zone', color: '#f9731620' },
    ],
    legend: [
      { num: 1, label: 'Staff Entry', type: 'staff' },
      { num: 2, label: 'Nurse Work Area (360° Visibility)', type: 'work' },
      { num: 3, label: 'Family Zone', type: 'family' },
    ],
  },
  {
    id: 'trauma',
    name: 'Emergency Trauma Bay',
    subtitle: 'Trauma resuscitation — 400–500 SF',
    color: '#ef4444',
    sqft: '400–500 SF',
    zones: [
      { label: 'Staff Work Area', color: '#4f6ef730' },
      { label: 'Equipment Zone', color: '#10b98125' },
    ],
    legend: [
      { num: 1, label: 'Patient Entry', type: 'patient' },
      { num: 2, label: 'Staff Work Area', type: 'work' },
      { num: 3, label: 'Equipment / Treatment Zone', type: 'equip' },
      { num: 4, label: 'Supply Access', type: 'supply' },
    ],
  },
  {
    id: 'or',
    name: 'Operating Room (OR)',
    subtitle: 'General surgery OR — 600–800 SF',
    color: '#8b5cf6',
    sqft: '600–800 SF',
    zones: [
      { label: 'Sterile Core', color: '#8b5cf620' },
      { label: 'Surgical Team Zone', color: '#4f6ef720' },
    ],
    legend: [
      { num: 1, label: 'Sterile Core', type: 'sterile' },
      { num: 2, label: 'Surgical Team Zone', type: 'team' },
      { num: 3, label: 'Anesthesia Zone', type: 'anesth' },
      { num: 4, label: 'Equipment / Support Zone', type: 'equip' },
    ],
  },
]

function IcuRoom({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 220 180" className="w-full max-w-xs">
      {/* Room boundary */}
      <rect x={10} y={10} width={200} height={160} rx={4} fill="#1a1d2790" stroke={`${color}40`} strokeWidth={1.5} />
      {/* Patient bed area */}
      <rect x={50} y={35} width={120} height={80} rx={3} fill={`${color}15`} stroke={`${color}40`} strokeWidth={1} />
      {/* Bed */}
      <rect x={70} y={50} width={80} height={50} rx={4} fill={`${color}25`} stroke={`${color}60`} strokeWidth={1.5} />
      <rect x={75} y={53} width={20} height={15} rx={2} fill={`${color}40`} />
      <text x={110} y={80} textAnchor="middle" fontSize={9} fill={color}>Patient Bed</text>
      {/* Nurse station */}
      <rect x={10} y={115} width={200} height={35} rx={3} fill="#4f6ef720" stroke="#4f6ef740" strokeWidth={1} />
      <text x={110} y={137} textAnchor="middle" fontSize={9} fill="#4f6ef7">Nurse Work Area — 360° Visibility</text>
      {/* Family zone */}
      <rect x={155} y={35} width={50} height={75} rx={3} fill="#f9731618" stroke="#f9731640" strokeWidth={1} />
      <text x={180} y={72} textAnchor="middle" fontSize={8} fill="#f97316" transform="rotate(90, 180, 72)">Family Zone</text>
      {/* Zone markers */}
      {[1, 2, 3].map((n, i) => (
        <circle key={n} cx={[25, 110, 165][i]} cy={[130, 95, 60][i]} r={8} fill="#1a1d27" stroke={color} strokeWidth={1.5} />
      ))}
      {[1, 2, 3].map((n, i) => (
        <text key={n} x={[25, 110, 165][i]} y={[134, 99, 64][i]} textAnchor="middle" fontSize={8} fill={color} fontWeight={700}>{n}</text>
      ))}
      {/* Clean/dirty zones */}
      <line x1={10} y1={110} x2={210} y2={110} stroke="#10b98140" strokeWidth={1} strokeDasharray="4,3" />
      <text x={15} y={108} fontSize={7} fill="#10b98180">Clean Zone ↑</text>
    </svg>
  )
}

function TraumaRoom({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 220 180" className="w-full max-w-xs">
      <rect x={10} y={10} width={200} height={160} rx={4} fill="#1a1d2790" stroke={`${color}40`} strokeWidth={1.5} />
      {/* Treatment area */}
      <rect x={30} y={25} width={160} height={90} rx={3} fill={`${color}12`} stroke={`${color}35`} strokeWidth={1} />
      {/* Gurney */}
      <rect x={65} y={45} width={90} height={45} rx={4} fill={`${color}25`} stroke={`${color}60`} strokeWidth={1.5} />
      <text x={110} y={72} textAnchor="middle" fontSize={9} fill={color}>Trauma Bay</text>
      {/* Equipment zone */}
      <rect x={155} y={25} width={45} height={90} rx={3} fill="#10b98120" stroke="#10b98140" strokeWidth={1} />
      <text x={177} y={72} textAnchor="middle" fontSize={7} fill="#10b981" transform="rotate(90, 177, 72)">Equipment Zone</text>
      {/* Staff zone */}
      <rect x={30} y={125} width={160} height={35} rx={3} fill="#4f6ef718" stroke="#4f6ef740" strokeWidth={1} />
      <text x={110} y={147} textAnchor="middle" fontSize={9} fill="#4f6ef7">Staff Work Area</text>
      {/* Entry indicator */}
      <path d="M10,40 L25,40" stroke={color} strokeWidth={2} markerEnd={`url(#arrow-entry)`} />
      <text x={14} y={35} fontSize={7} fill={color}>Entry</text>
      {/* Markers */}
      {[1, 2, 3, 4].map((n, i) => (
        <circle key={n} cx={[20, 110, 170, 200][i]} cy={[55, 135, 65, 100][i]} r={8} fill="#1a1d27" stroke={color} strokeWidth={1.5} />
      ))}
      {[1, 2, 3, 4].map((n, i) => (
        <text key={n} x={[20, 110, 170, 200][i]} y={[59, 139, 69, 104][i]} textAnchor="middle" fontSize={8} fill={color} fontWeight={700}>{n}</text>
      ))}
    </svg>
  )
}

function OrRoom({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 220 180" className="w-full max-w-xs">
      <rect x={10} y={10} width={200} height={160} rx={4} fill="#1a1d2790" stroke={`${color}40`} strokeWidth={1.5} />
      {/* Sterile core */}
      <rect x={30} y={25} width={100} height={100} rx={3} fill={`${color}18`} stroke={`${color}50`} strokeWidth={1.5} strokeDasharray="4,2" />
      <text x={80} y={42} textAnchor="middle" fontSize={8} fill={color} fontStyle="italic">Sterile Core</text>
      {/* OR table */}
      <rect x={50} y={55} width={60} height={50} rx={4} fill={`${color}28`} stroke={`${color}70`} strokeWidth={1.5} />
      <text x={80} y={84} textAnchor="middle" fontSize={9} fill={color}>OR Table</text>
      {/* Surgical team zone */}
      <rect x={140} y={25} width={70} height={100} rx={3} fill="#4f6ef718" stroke="#4f6ef740" strokeWidth={1} />
      <text x={175} y={72} textAnchor="middle" fontSize={7} fill="#4f6ef7" transform="rotate(90,175,72)">Surgical Team</text>
      {/* Anesthesia */}
      <rect x={30} y={135} width={60} height={30} rx={3} fill="#fbbf2418" stroke="#fbbf2440" strokeWidth={1} />
      <text x={60} y={155} textAnchor="middle" fontSize={8} fill="#fbbf24">Anesthesia</text>
      {/* Equipment */}
      <rect x={100} y={135} width={110} height={30} rx={3} fill="#10b98115" stroke="#10b98140" strokeWidth={1} />
      <text x={155} y={155} textAnchor="middle" fontSize={8} fill="#10b981">Equipment / Support</text>
      {/* Markers */}
      {[1, 2, 3, 4].map((n, i) => (
        <circle key={n} cx={[80, 175, 60, 155][i]} cy={[60, 45, 148, 148][i]} r={8} fill="#1a1d27" stroke={color} strokeWidth={1.5} />
      ))}
      {[1, 2, 3, 4].map((n, i) => (
        <text key={n} x={[80, 175, 60, 155][i]} y={[64, 49, 152, 152][i]} textAnchor="middle" fontSize={8} fill={color} fontWeight={700}>{n}</text>
      ))}
      {/* Sterile zone borders */}
      <line x1={30} y1={130} x2={210} y2={130} stroke="#10b98140" strokeWidth={1} strokeDasharray="4,3" />
      <text x={35} y={128} fontSize={7} fill="#10b98180">Sterile Zone ↑</text>
    </svg>
  )
}

const ROOM_SVGS: Record<RoomType, React.ComponentType<{ color: string }>> = {
  icu: IcuRoom,
  trauma: TraumaRoom,
  or: OrRoom,
}

export default function RoomTypeModule({ departments }: Props) {
  const [active, setActive] = useState<RoomType>('icu')

  const hasICU = departments.some(d => d.type === 'icu')
  const hasED = departments.some(d => d.type === 'emergency')
  const hasSurg = departments.some(d => d.type === 'surgery')

  const available = ROOMS.filter(r =>
    (r.id === 'icu' && (hasICU || departments.length === 0)) ||
    (r.id === 'trauma' && (hasED || departments.length === 0)) ||
    (r.id === 'or' && (hasSurg || departments.length === 0)) ||
    departments.length === 0
  )

  const room = ROOMS.find(r => r.id === active) || ROOMS[0]
  const SvgComp = ROOM_SVGS[active]

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-none px-5 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-white">Clinical Room / Module Diagrams</h3>
        <p className="text-xs text-muted mt-0.5">Typical room layouts showing workflows, equipment, and adjacencies</p>
      </div>

      {/* Room type tabs */}
      <div className="flex-none border-b border-border flex">
        {ROOMS.map(r => (
          <button
            key={r.id}
            onClick={() => setActive(r.id)}
            className={`flex-1 py-2.5 px-3 text-xs font-medium transition-colors ${
              active === r.id
                ? 'text-white border-b-2'
                : 'text-muted hover:text-white'
            }`}
            style={active === r.id ? { borderBottomColor: r.color } : {}}
          >
            {r.name.split('(')[0].trim()}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="flex gap-8 items-start">
          {/* Room diagram */}
          <div className="flex-1">
            <div className="mb-3">
              <h4 className="text-sm font-semibold" style={{ color: room.color }}>{room.name}</h4>
              <p className="text-xs text-muted">{room.subtitle}</p>
            </div>
            <div className="rounded-xl border border-border bg-panel/50 p-4">
              <SvgComp color={room.color} />
            </div>
          </div>

          {/* Legend + zones */}
          <div className="w-52 flex-none">
            <div className="mb-4">
              <p className="text-xs font-medium text-muted uppercase tracking-wider mb-3">Zone Legend</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-sm border" style={{ backgroundColor: `${room.color}15`, borderColor: `${room.color}40` }} />
                  <span className="text-xs text-muted">Primary Care Zone</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-sm bg-blue-500/15 border border-blue-500/30" />
                  <span className="text-xs text-muted">Staff Work Zone</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-sm bg-emerald-500/15 border border-emerald-500/30" />
                  <span className="text-xs text-muted">Equipment Zone</span>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-xs font-medium text-muted uppercase tracking-wider mb-3">Key Elements</p>
              <div className="space-y-2">
                {room.legend.map(item => (
                  <div key={item.num} className="flex items-start gap-2.5">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-none mt-0.5"
                      style={{ backgroundColor: `${room.color}20`, color: room.color, border: `1px solid ${room.color}50` }}
                    >
                      {item.num}
                    </div>
                    <span className="text-xs text-muted leading-tight">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border mt-4 pt-4">
              <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">Circulation Paths</p>
              {[
                { color: '#10b981', label: 'Clean Zone' },
                { color: '#ef4444', label: 'Circulation Path' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-0.5 rounded" style={{ backgroundColor: color, opacity: 0.7 }} />
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
