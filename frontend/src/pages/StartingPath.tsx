import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Activity, ArrowLeft, Upload, GitBranch, CheckCircle, Loader, ChevronRight, BarChart2, Users } from 'lucide-react'
import { updateProject, getProject, getIntelligence } from '../api/client'
import { useProjectStore } from '../store/projectStore'
import SiteIntelligencePanel from '../components/SiteIntelligencePanel'

export default function StartingPath() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { currentProject, setCurrentProject, updateCurrentProject } = useProjectStore()
  const [intelligence, setIntelligence] = useState<{ status: string } | null>(null)
  const [choosing, setChoosing] = useState(false)
  const [showIntel, setShowIntel] = useState(false)

  useEffect(() => {
    if (!currentProject && projectId) {
      getProject(projectId).then(setCurrentProject).catch(console.error)
    }
  }, [projectId])

  // Poll intelligence status
  useEffect(() => {
    if (!projectId) return
    const poll = async () => {
      try {
        const intel = await getIntelligence(projectId)
        setIntelligence(intel)
        if (intel.status !== 'completed' && intel.status !== 'failed') {
          setTimeout(poll, 3000)
        }
      } catch {
        // not yet created
        setTimeout(poll, 3000)
      }
    }
    poll()
    return () => {}
  }, [projectId])

  const handleChoose = async (mode: 'upload' | 'generate') => {
    if (!projectId || choosing) return
    setChoosing(true)
    try {
      await updateProject(projectId, {
        starting_mode: mode,
        status: mode === 'upload' ? 'upload_design' : 'bubble_diagram',
      })
      updateCurrentProject({ starting_mode: mode })
      navigate(`/project/${projectId}/${mode === 'upload' ? 'upload' : 'bubble'}`)
    } finally {
      setChoosing(false)
    }
  }

  const intelStatus = intelligence?.status

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="border-b border-border px-6 py-3 flex items-center gap-4">
        <button onClick={() => navigate(`/project/${projectId}/site`)} className="text-muted hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-accent" />
          <span className="text-sm text-muted">{currentProject?.name || 'Project'}</span>
        </div>
        <div className="flex items-center gap-3 ml-auto">
          {/* Site Intelligence toggle */}
          <button
            onClick={() => setShowIntel(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              intelStatus === 'completed'
                ? 'border-accent/40 text-accent bg-accent/10 hover:bg-accent/20'
                : intelStatus === 'processing' || intelStatus === 'pending'
                ? 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20'
                : 'border-border text-muted hover:text-white hover:border-accent/40'
            }`}
          >
            <BarChart2 size={14} />
            Site Intelligence
            {(intelStatus === 'pending' || intelStatus === 'processing') && (
              <Loader size={12} className="animate-spin ml-0.5" />
            )}
            {intelStatus === 'completed' && <CheckCircle size={12} className="ml-0.5" />}
          </button>

          <div className="flex items-center gap-1.5">
            {['Site', 'Path', 'Program'].map((step, i) => (
              <div key={step} className="flex items-center gap-1.5">
                <div className={`flex items-center gap-1.5 ${i === 1 ? 'text-accent' : i < 1 ? 'text-emerald-400' : 'text-muted'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium border ${i === 1 ? 'border-accent bg-accent text-white' : i < 1 ? 'border-emerald-400 bg-emerald-400/20' : 'border-border'}`}>
                    {i < 1 ? '✓' : i + 1}
                  </div>
                  <span className="text-xs">{step}</span>
                </div>
                {i < 2 && <div className="w-6 h-px bg-border" />}
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-8 py-16">
        {/* Intelligence status banner */}
        <div className={`mb-10 px-5 py-3.5 rounded-xl border flex items-center gap-3 text-sm ${
          intelStatus === 'completed' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
          intelStatus === 'failed' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
          'bg-accent/10 border-accent/30 text-accent'
        }`}>
          {intelStatus === 'completed' ? (
            <CheckCircle size={16} />
          ) : intelStatus === 'failed' ? (
            <span>⚠</span>
          ) : (
            <Loader size={16} className="animate-spin" />
          )}
          <div>
            {intelStatus === 'completed' && 'Site intelligence analysis complete — zoning, restrictions, and healthcare constraints loaded.'}
            {intelStatus === 'failed' && 'Site analysis encountered an issue. You can continue without it.'}
            {(!intelStatus || intelStatus === 'pending' || intelStatus === 'processing') &&
              'Running background site intelligence analysis — gathering zoning, restrictions, and healthcare planning context…'}
          </div>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">How would you like to start?</h1>
        <p className="text-muted mb-10">Choose a workflow based on your project type. You can always switch later.</p>

        {/* Collaboration CTA */}
        <div
          onClick={() => navigate(`/project/${projectId}/collaborate`)}
          className="mb-8 cursor-pointer flex items-center gap-4 bg-panel border border-accent/30 hover:border-accent rounded-2xl px-6 py-5 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center flex-none">
            <Users size={22} className="text-accent" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-base font-semibold text-white group-hover:text-accent transition-colors">Start Collaboration Session</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25 font-medium">New</span>
            </div>
            <p className="text-sm text-muted">Doctor + Architect real-time collaboration — AI generates all 7 diagram types from your conversation</p>
          </div>
          <ChevronRight size={18} className="text-muted group-hover:text-accent group-hover:translate-x-1 transition-all flex-none" />
        </div>

        <p className="text-sm text-muted mb-6">Or start with a single workflow:</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Option A: Upload */}
          <button
            onClick={() => handleChoose('upload')}
            disabled={choosing}
            className="group text-left bg-panel hover:bg-card border border-border hover:border-accent/40 rounded-2xl p-7 transition-all disabled:opacity-50"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-5">
              <Upload size={22} className="text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2 group-hover:text-accent transition-colors">
              Upload Existing Design
            </h2>
            <p className="text-muted text-sm leading-relaxed mb-5">
              Import existing floor plans, DXF files, or PDFs. Best for renovations, redesigns, and existing hospital projects.
            </p>
            <ul className="space-y-1.5 mb-6">
              {['DXF / CAD files', 'PDF floor plans', 'Image scans', 'Program spreadsheets'].map(item => (
                <li key={item} className="flex items-center gap-2 text-xs text-muted">
                  <div className="w-1 h-1 rounded-full bg-blue-400" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2 text-accent text-sm font-medium">
              <span>Upload files</span>
              <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Option B: Generate */}
          <button
            onClick={() => handleChoose('generate')}
            disabled={choosing}
            className="group text-left bg-panel hover:bg-card border border-border hover:border-accent/40 rounded-2xl p-7 transition-all disabled:opacity-50"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-5">
              <GitBranch size={22} className="text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2 group-hover:text-accent transition-colors">
              Start from Requirements
            </h2>
            <p className="text-muted text-sm leading-relaxed mb-5">
              Describe your facility needs and let AI generate a bubble diagram program. Best for new projects and early-stage planning.
            </p>
            <ul className="space-y-1.5 mb-6">
              {['AI-generated bubble diagram', 'Editable adjacency canvas', 'Iterative chat refinement', 'Program area schedule'].map(item => (
                <li key={item} className="flex items-center gap-2 text-xs text-muted">
                  <div className="w-1 h-1 rounded-full bg-purple-400" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2 text-accent text-sm font-medium">
              <span>Generate program</span>
              <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>
      </main>

      {/* Site Intelligence Panel */}
      {projectId && (
        <SiteIntelligencePanel
          isOpen={showIntel}
          onClose={() => setShowIntel(false)}
          projectId={projectId}
        />
      )}
    </div>
  )
}
