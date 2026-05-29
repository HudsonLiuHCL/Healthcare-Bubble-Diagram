import type { Department } from '../../store/collabStore'

type Rel = 'must-adjacent' | 'should-near' | 'neutral' | 'should-separate' | 'must-separate'

interface Props {
  departments: Department[]
  edges: any[]
}

function getRelationship(a: Department, b: Department, edges: any[]): Rel {
  const edge = edges.find(
    e => (e.source === a.id && e.target === b.id) || (e.source === b.id && e.target === a.id),
  )
  if (edge) {
    return edge.data?.strength === 'required' ? 'must-adjacent' : 'should-near'
  }
  const aZone = a.zone || ''
  const bZone = b.zone || ''
  if (
    (aZone === 'service' && bZone === 'public') ||
    (aZone === 'public' && bZone === 'service')
  ) return 'must-separate'
  if (aZone === 'service' || bZone === 'service') return 'should-separate'
  return 'neutral'
}

const REL_CONFIG: Record<Rel, { label: string; cell: string; text: string; symbol: string }> = {
  'must-adjacent':  { label: 'Must Be Adjacent',    cell: 'bg-emerald-500/25 border-emerald-500/40',   text: 'text-emerald-300', symbol: '━━' },
  'should-near':    { label: 'Should Be Near',       cell: 'bg-emerald-500/10 border-emerald-500/20',   text: 'text-emerald-400', symbol: '╌╌' },
  'neutral':        { label: 'Neutral',              cell: 'bg-blue-500/8 border-blue-500/15',           text: 'text-blue-400',    symbol: '──' },
  'should-separate':{ label: 'Should Be Separate',   cell: 'bg-red-500/10 border-red-500/20',            text: 'text-red-400',     symbol: '╌╌' },
  'must-separate':  { label: 'Must Be Separated',    cell: 'bg-red-500/20 border-red-500/40',            text: 'text-red-300',     symbol: '✕' },
}

const LEGEND: [Rel, string][] = [
  ['must-adjacent',   '━━  Must Be Adjacent'],
  ['should-near',     '╌╌  Should Be Near'],
  ['neutral',         '──  Neutral'],
  ['should-separate', '╌╌  Should Be Separate'],
  ['must-separate',   '✕   Must Be Separated'],
]

export default function AdjacencyMatrix({ departments, edges }: Props) {
  if (departments.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        Generate diagrams from the chat panel to see the adjacency matrix.
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Title */}
      <div className="flex-none px-5 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Adjacency Diagram</h3>
          <p className="text-xs text-muted mt-0.5">Defines which departments should be near, far, or separated</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* Matrix */}
        <div className="overflow-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="w-32 h-8" />
                {departments.map(d => (
                  <th key={d.id} className="h-8 w-20 pb-1">
                    <div
                      className="transform -rotate-45 origin-bottom-left w-28 text-left pl-1 font-normal text-muted truncate"
                      style={{ color: d.color }}
                    >
                      {d.name.split(' ')[0]}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {departments.map((rowDept, ri) => (
                <tr key={rowDept.id}>
                  <td className="pr-3 py-1 text-right">
                    <span className="font-medium truncate block max-w-[120px] text-right" style={{ color: rowDept.color }}>
                      {rowDept.name.length > 16 ? rowDept.name.split(' ').slice(0, 2).join(' ') : rowDept.name}
                    </span>
                  </td>
                  {departments.map((colDept, ci) => {
                    if (ri === ci) {
                      return (
                        <td key={colDept.id} className="p-0.5">
                          <div className="w-16 h-7 bg-border/40 rounded flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: rowDept.color }} />
                          </div>
                        </td>
                      )
                    }
                    const rel = getRelationship(rowDept, colDept, edges)
                    const cfg = REL_CONFIG[rel]
                    return (
                      <td key={colDept.id} className="p-0.5">
                        <div
                          title={`${rowDept.name} ↔ ${colDept.name}: ${cfg.label}`}
                          className={`w-16 h-7 rounded border flex items-center justify-center cursor-default font-mono text-xs font-bold transition-opacity hover:opacity-80 ${cfg.cell} ${cfg.text}`}
                        >
                          {cfg.symbol}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-6 border-t border-border pt-4">
          <p className="text-xs font-medium text-muted uppercase tracking-wider mb-3">Legend</p>
          <div className="grid grid-cols-2 gap-2">
            {LEGEND.map(([rel, label]) => {
              const cfg = REL_CONFIG[rel]
              return (
                <div key={rel} className="flex items-center gap-2">
                  <div className={`w-10 h-5 rounded border flex items-center justify-center font-mono text-xs font-bold ${cfg.cell} ${cfg.text}`}>
                    {cfg.symbol}
                  </div>
                  <span className="text-xs text-muted">{label.split('  ')[1]}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
