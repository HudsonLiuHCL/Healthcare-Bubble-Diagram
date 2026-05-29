import { useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Stethoscope, PenTool, ChevronRight, ArrowLeft, Activity } from 'lucide-react'
import { getProject, getIntelligence } from '../api/client'
import { useProjectStore } from '../store/projectStore'
import StepChain from '../components/StepChain'
import SiteIntelligencePanel from '../components/SiteIntelligencePanel'

export default function CollaborationLanding() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { currentProject, setCurrentProject } = useProjectStore()
  const [showIntel, setShowIntel] = useState(false)
  const [intelStatus, setIntelStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return
    if (!currentProject) getProject(projectId).then(setCurrentProject).catch(console.error)
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const intel = await getIntelligence(projectId)
        setIntelStatus(intel.status)
        if (intel.status !== 'completed' && intel.status !== 'failed')
          timer = setTimeout(poll, 4000)
      } catch { timer = setTimeout(poll, 5000) }
    }
    poll()
    return () => clearTimeout(timer)
  }, [projectId])

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-3 flex items-center gap-4">
        <button onClick={() => navigate(`/project/${projectId}/site`)} className="text-muted hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-accent" />
          <span className="text-sm text-muted">{currentProject?.name || 'Project'}</span>
        </div>
      </header>

      <StepChain current="collab" projectId={projectId} intelStatus={intelStatus} onSiteAnalysisClick={() => setShowIntel(true)} />

      <main className="flex-1 flex flex-col items-center justify-center px-8 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">Open your view</h1>
          <p className="text-muted max-w-md">
            Open both windows side-by-side. Diagrams and chat sync live between them.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-2xl">
          {/* Doctor */}
          <button
            onClick={() => navigate(`/project/${projectId}/doctor`)}
            className="group text-left bg-panel hover:bg-card border border-border hover:border-emerald-500/50 rounded-2xl p-7 transition-all"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center mb-5">
              <Stethoscope size={24} className="text-emerald-400" />
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">Clinical Team</span>
            <h2 className="text-lg font-bold text-white mt-3 mb-2 group-hover:text-emerald-400 transition-colors">Doctor View</h2>
            <p className="text-muted text-sm leading-relaxed mb-5">
              Input clinical requirements, view all diagrams read-only, comment on designs, and track the metrics you care about.
            </p>
            <ul className="space-y-1.5 mb-6">
              {['10+ clinical metrics (beds, budget, OR utilization…)', 'View all 7 diagram types', 'Comment on any diagram', 'Live chat with architect + AI'].map(item => (
                <li key={item} className="flex items-start gap-2 text-xs text-muted">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-none" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
              Open Doctor View <ChevronRight size={15} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Architect */}
          <button
            onClick={() => navigate(`/project/${projectId}/architect`)}
            className="group text-left bg-panel hover:bg-card border border-border hover:border-accent/50 rounded-2xl p-7 transition-all"
          >
            <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center mb-5">
              <PenTool size={24} className="text-accent" />
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25">Design Team</span>
            <h2 className="text-lg font-bold text-white mt-3 mb-2 group-hover:text-accent transition-colors">Architect View</h2>
            <p className="text-muted text-sm leading-relaxed mb-5">
              Edit all 7 diagram types directly. Use the AI bar at the bottom to regenerate diagrams from natural language instructions.
            </p>
            <ul className="space-y-1.5 mb-6">
              {['Bubble, adjacency, stacking, workflow…', 'AI design bar — edit diagrams by chat', 'Program data + FGI compliance', 'Live chat with doctor + AI'].map(item => (
                <li key={item} className="flex items-start gap-2 text-xs text-muted">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 flex-none" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2 text-accent text-sm font-medium">
              Open Architect View <ChevronRight size={15} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>

        <p className="mt-8 text-xs text-muted">
          Tip: open Doctor and Architect in two separate browser windows — messages and diagrams sync in real time.
        </p>
      </main>

      {projectId && (
        <SiteIntelligencePanel isOpen={showIntel} onClose={() => setShowIntel(false)} projectId={projectId} />
      )}
    </div>
  )
}
