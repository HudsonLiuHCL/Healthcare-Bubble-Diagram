import type { Department } from '../../store/collabStore'

interface Props {
  departments: Department[]
}

export default function MassingDiagram({ departments }: Props) {
  const hasInpatient = departments.some(d => d.type === 'inpatient')
  const hasSurgery = departments.some(d => d.type === 'surgery')
  const hasService = departments.some(d => d.zone === 'service' || d.type === 'support')

  const totalBeds = departments.reduce((s, d) => s + (d.beds || 0), 0)
  const totalFloors = hasInpatient ? 4 : hasSurgery ? 3 : 2

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-none px-5 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-white">Massing Diagram (Early)</h3>
        <p className="text-xs text-muted mt-0.5">Conceptual 3D view showing the overall form and how volumes relate</p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="flex gap-8 items-start">
          {/* 3D Massing SVG */}
          <div className="flex-1">
            <svg viewBox="0 0 600 420" className="w-full max-w-xl">
              {/* Ground shadow */}
              <ellipse cx="300" cy="390" rx="240" ry="18" fill="#00000040" />

              {/* Service / Loading volume (back-left) */}
              {hasService && (
                <g>
                  <polygon points="60,310 150,280 150,360 60,390" fill="#374151" stroke="#4b5563" strokeWidth={1} />
                  <polygon points="60,310 150,280 230,300 140,330" fill="#4b5563" stroke="#6b7280" strokeWidth={1} />
                  <polygon points="140,330 230,300 230,380 140,410" fill="#2d3748" stroke="#4b5563" strokeWidth={1} />
                  <text x="95" y="345" fontSize={10} fill="#9ca3af" textAnchor="middle" transform="rotate(-5, 95, 345)">Service &</text>
                  <text x="95" y="360" fontSize={10} fill="#9ca3af" textAnchor="middle" transform="rotate(-5, 95, 360)">Loading</text>
                </g>
              )}

              {/* Support / Admin volume (center-low) */}
              <g>
                <polygon points="160,260 310,220 310,330 160,370" fill="#10b98118" stroke="#10b98160" strokeWidth={1.5} />
                <polygon points="160,260 310,220 400,240 250,280" fill="#10b98130" stroke="#10b98180" strokeWidth={1.5} />
                <polygon points="250,280 400,240 400,350 250,390" fill="#10b98110" stroke="#10b98150" strokeWidth={1.5} />
                <text x="230" y="305" fontSize={11} fill="#10b981" textAnchor="middle">Support</text>
                <text x="230" y="320" fontSize={9} fill="#10b98190" textAnchor="middle">Back of House</text>
              </g>

              {/* Clinical volume (center) */}
              <g>
                <polygon points="200,180 370,130 370,280 200,330" fill="#ef444415" stroke="#ef444460" strokeWidth={1.5} />
                <polygon points="200,180 370,130 460,160 290,210" fill="#ef444430" stroke="#ef444480" strokeWidth={1.5} />
                <polygon points="290,210 460,160 460,310 290,360" fill="#ef444410" stroke="#ef444450" strokeWidth={1.5} />
                <text x="310" y="250" fontSize={12} fill="#ef4444" textAnchor="middle" fontWeight={600}>Clinical</text>
                <text x="310" y="268" fontSize={9} fill="#ef444490" textAnchor="middle">Centralized Care Areas</text>
                {hasSurgery && <text x="310" y="284" fontSize={9} fill="#ef444480" textAnchor="middle">Surgery · ICU · ED</text>}
              </g>

              {/* Inpatient Tower (tall, right side) */}
              {hasInpatient && (
                <g>
                  <polygon points="350,60 490,20 490,200 350,240" fill="#3b82f615" stroke="#3b82f660" strokeWidth={1.5} />
                  <polygon points="350,60 490,20 540,50 400,90" fill="#3b82f630" stroke="#3b82f680" strokeWidth={1.5} />
                  <polygon points="400,90 540,50 540,230 400,270" fill="#3b82f610" stroke="#3b82f650" strokeWidth={1.5} />
                  {/* Window grid */}
                  {[0,1,2,3,4,5].map(row => (
                    [0,1,2].map(col => (
                      <rect
                        key={`win-${row}-${col}`}
                        x={360 + col * 28}
                        y={75 + row * 25}
                        width={18} height={14} rx={2}
                        fill="#3b82f620" stroke="#3b82f640" strokeWidth={0.5}
                      />
                    ))
                  ))}
                  <text x="420" y="185" fontSize={12} fill="#3b82f6" textAnchor="middle" fontWeight={600}>Inpatient</text>
                  <text x="420" y="200" fontSize={9} fill="#3b82f690" textAnchor="middle">Tower ({totalBeds} beds)</text>
                  <text x="420" y="215" fontSize={9} fill="#3b82f680" textAnchor="middle">Private · Quiet · Views</text>
                </g>
              )}

              {/* Public entrance / lobby (front) */}
              <g>
                <polygon points="120,330 270,290 270,370 120,410" fill="#f9731620" stroke="#f9731660" strokeWidth={1.5} />
                <polygon points="120,330 270,290 330,310 180,350" fill="#f9731635" stroke="#f9731680" strokeWidth={1.5} />
                <polygon points="180,350 330,310 330,390 180,430" fill="#f9731615" stroke="#f9731650" strokeWidth={1.5} />
                {/* Entrance canopy */}
                <polygon points="155,345 215,328 215,340 155,357" fill="#f9731640" stroke="#f9731680" strokeWidth={1} />
                <text x="200" y="380" fontSize={11} fill="#f97316" textAnchor="middle" fontWeight={600}>Public Entry</text>
                <text x="200" y="395" fontSize={9} fill="#f9731690" textAnchor="middle">Easy Access · Welcoming</text>
              </g>

              {/* Floor labels on tower */}
              {hasInpatient && Array.from({ length: totalFloors }).map((_, i) => (
                <text key={i} x={348} y={220 - i * 38} fontSize={8} fill="#3b82f680" textAnchor="end">
                  FL {i + 1}
                </text>
              ))}

              {/* Compass / North indicator */}
              <g transform="translate(560, 40)">
                <circle cx={0} cy={0} r={16} fill="#1a1d27" stroke="#2d3148" strokeWidth={1} />
                <text x={0} y={-6} fontSize={8} fill="#4f6ef7" textAnchor="middle" fontWeight={700}>N</text>
                <line x1={0} y1={-13} x2={0} y2={13} stroke="#4f6ef780" strokeWidth={1} />
                <polygon points="0,-13 -3,0 3,0" fill="#4f6ef7" />
              </g>
            </svg>
          </div>

          {/* Labels */}
          <div className="w-48 flex-none">
            <p className="text-xs font-medium text-muted uppercase tracking-wider mb-4">Volume Key</p>
            <div className="space-y-4">
              {hasInpatient && (
                <div className="flex items-start gap-3">
                  <div className="w-4 h-4 rounded-sm mt-0.5 flex-none" style={{ backgroundColor: '#3b82f620', border: '1px solid #3b82f660' }} />
                  <div>
                    <div className="text-xs font-semibold text-blue-400">Inpatient Tower</div>
                    <div className="text-xs text-muted">Private, Quiet, Good Views</div>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <div className="w-4 h-4 rounded-sm mt-0.5 flex-none" style={{ backgroundColor: '#ef444420', border: '1px solid #ef444460' }} />
                <div>
                  <div className="text-xs font-semibold text-red-400">Clinical Volume</div>
                  <div className="text-xs text-muted">Centralized Care Areas</div>
                </div>
              </div>
              {hasService && (
                <div className="flex items-start gap-3">
                  <div className="w-4 h-4 rounded-sm mt-0.5 flex-none" style={{ backgroundColor: '#37414140', border: '1px solid #4b556360' }} />
                  <div>
                    <div className="text-xs font-semibold text-slate-400">Support Volume</div>
                    <div className="text-xs text-muted">Back of House, Services</div>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <div className="w-4 h-4 rounded-sm mt-0.5 flex-none" style={{ backgroundColor: '#f9731620', border: '1px solid #f9731660' }} />
                <div>
                  <div className="text-xs font-semibold text-orange-400">Public Front Door</div>
                  <div className="text-xs text-muted">Easy Access, Welcoming</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-4 h-4 rounded-sm mt-0.5 flex-none" style={{ backgroundColor: '#10b98120', border: '1px solid #10b98150' }} />
                <div>
                  <div className="text-xs font-semibold text-emerald-400">Service / Loading</div>
                  <div className="text-xs text-muted">Out of Sight, Direct Access</div>
                </div>
              </div>
            </div>

            <div className="border-t border-border mt-5 pt-4">
              <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">Metrics</p>
              <div className="text-xs text-muted space-y-1">
                <div>Floors: <span className="text-white">{totalFloors}</span></div>
                <div>Est. Height: <span className="text-white">~{totalFloors * 4.2}m</span></div>
                {totalBeds > 0 && <div>Beds: <span className="text-white">{totalBeds}</span></div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
