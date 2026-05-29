import { useNavigate } from 'react-router-dom'
import { MapPin, BarChart2, Users, Check, Loader } from 'lucide-react'

export type Step = 'site' | 'analyze' | 'collab'

interface StepDef {
  id: Step
  label: string
  sub: string
  icon: React.ElementType
}

const STEPS: StepDef[] = [
  { id: 'site',    label: 'Select Site',   sub: 'Map + parcel',       icon: MapPin },
  { id: 'analyze', label: 'Site Analysis', sub: 'AI constraints',     icon: BarChart2 },
  { id: 'collab',  label: 'Collaborate',   sub: 'Doctor + Architect', icon: Users },
]

const ORDER: Record<Step, number> = { site: 0, analyze: 1, collab: 2 }

interface Props {
  current: Step
  projectId?: string
  intelStatus?: string | null
  onSiteAnalysisClick?: () => void
}

export default function StepChain({ current, projectId, intelStatus, onSiteAnalysisClick }: Props) {
  const navigate = useNavigate()
  const currentIdx = ORDER[current]

  const isAnalyzing = intelStatus === 'pending' || intelStatus === 'processing'
  const isAnalyzed  = intelStatus === 'completed'

  const handleClick = (step: StepDef, idx: number) => {
    if (!projectId) return
    if (step.id === 'site')    navigate(`/project/${projectId}/site`)
    if (step.id === 'analyze') onSiteAnalysisClick?.()
    if (step.id === 'collab')  navigate(`/project/${projectId}/collaborate`)
  }

  return (
    <div className="flex-none flex items-center justify-center gap-0 bg-panel border-b border-border px-6 py-2">
      {STEPS.map((step, i) => {
        const Icon = step.icon
        const done   = i < currentIdx || (step.id === 'analyze' && isAnalyzed && currentIdx >= 1)
        const active = i === currentIdx
        const analyzing = step.id === 'analyze' && isAnalyzing
        const clickable = !!projectId

        return (
          <div key={step.id} className="flex items-center">
            <button
              onClick={() => handleClick(step, i)}
              disabled={!clickable}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                clickable ? 'cursor-pointer' : 'cursor-default'
              } ${
                active
                  ? 'bg-accent/15 border border-accent/40'
                  : done
                  ? 'hover:bg-card border border-transparent hover:border-emerald-500/20 opacity-80 hover:opacity-100'
                  : 'border border-transparent opacity-40 hover:opacity-60'
              }`}
            >
              {/* Icon bubble */}
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-none ${
                analyzing
                  ? 'bg-yellow-500/20 border border-yellow-500/40'
                  : done
                  ? 'bg-emerald-500/20 border border-emerald-500/40'
                  : active
                  ? 'bg-accent/20 border border-accent/50'
                  : 'bg-border border border-border'
              }`}>
                {analyzing
                  ? <Loader size={9} className="text-yellow-400 animate-spin" />
                  : done
                  ? <Check size={9} className="text-emerald-400" />
                  : <Icon size={9} className={active ? 'text-accent' : 'text-muted'} />
                }
              </div>

              <div className="text-left">
                <div className={`text-xs font-semibold leading-none ${
                  analyzing ? 'text-yellow-400' :
                  done      ? 'text-emerald-400' :
                  active    ? 'text-white' : 'text-muted'
                }`}>
                  {step.label}
                  {analyzing && <span className="text-yellow-400/70 font-normal ml-1">analyzing…</span>}
                </div>
                <div className="text-xs text-muted leading-none mt-0.5">{step.sub}</div>
              </div>
            </button>

            {/* Connector */}
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-px mx-1 transition-colors ${i < currentIdx || (i === 0 && isAnalyzed) ? 'bg-emerald-500/40' : 'bg-border'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
