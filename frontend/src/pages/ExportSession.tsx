import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Activity, ArrowLeft, Download, Database, CheckCircle,
  FileJson, FileText, Layers, Grid3x3, BarChart2, Workflow,
  LayoutDashboard, Building, BedDouble, DollarSign, Building2,
  Sparkles, RefreshCw, Loader,
} from 'lucide-react'
import { getProject, updateProject, exportProject } from '../api/client'
import { useProjectStore } from '../store/projectStore'
import { useCollabStore } from '../store/collabStore'
import StepChain from '../components/StepChain'
import AdjacencyMatrix from '../components/diagrams/AdjacencyMatrix'
import StackingDiagram from '../components/diagrams/StackingDiagram'
import WorkflowDiagram from '../components/diagrams/WorkflowDiagram'
import FloorPlan from '../components/diagrams/FloorPlan'
import MassingDiagram from '../components/diagrams/MassingDiagram'
import RoomTypeModule from '../components/diagrams/RoomTypeModule'

type PreviewTab = 'stacking' | 'adjacency' | 'workflow' | 'floorplan' | 'massing' | 'roomtypes'

const PREVIEW_TABS: { id: PreviewTab; label: string; icon: React.ElementType }[] = [
  { id: 'stacking',  label: 'Stacking',   icon: BarChart2 },
  { id: 'adjacency', label: 'Adjacency',  icon: Grid3x3 },
  { id: 'workflow',  label: 'Workflow',   icon: Workflow },
  { id: 'floorplan', label: 'Floor Plan', icon: LayoutDashboard },
  { id: 'massing',   label: 'Massing',    icon: Building },
  { id: 'roomtypes', label: 'Room Types', icon: Grid3x3 },
]

type SaveState = 'idle' | 'saving' | 'saved'

export default function ExportSession() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { currentProject, setCurrentProject } = useProjectStore()
  const { init: initStore, programData, bubbleNodes, bubbleEdges, messages } = useCollabStore()

  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [previewTab, setPreviewTab] = useState<PreviewTab>('stacking')

  useEffect(() => {
    if (!projectId) return
    initStore(projectId)
    if (!currentProject) getProject(projectId).then(setCurrentProject).catch(console.error)
  }, [projectId])

  const departments = programData?.departments || []
  const totalBeds = programData?.total_beds || 100
  const totalArea = programData?.total_area_sqm || 7230
  const budgetM = Math.round((totalArea * 4800) / 1_000_000)
  const doctorMsgCount = messages.filter(m => m.role === 'doctor').length
  const archMsgCount = messages.filter(m => m.role === 'architect').length

  const handleSaveDB = async () => {
    if (!projectId || saveState !== 'idle') return
    setSaveState('saving')
    try {
      await updateProject(projectId, { status: 'completed' })
      setSaveState('saved')
    } catch {
      setSaveState('idle')
      alert('Save failed — check the backend.')
    }
  }

  const handleExportJSON = async () => {
    if (!projectId) return
    try {
      const data = await exportProject(projectId)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${currentProject?.name || 'project'}-export.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Export failed.')
    }
  }

  const handleExportCollab = () => {
    const lines = messages.map(m =>
      `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.role.toUpperCase()}: ${m.text}`
    ).join('\n')
    const blob = new Blob([lines], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentProject?.name || 'project'}-collaboration-log.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="border-b border-border px-6 py-3 flex items-center gap-4">
        <button onClick={() => navigate(`/project/${projectId}/collaborate`)} className="text-muted hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-accent" />
          <span className="text-sm text-muted">{currentProject?.name || 'Project'}</span>
          <span className="text-muted">/</span>
          <span className="text-sm text-white">Export & Save</span>
        </div>
      </header>

      <StepChain current="collab" projectId={projectId} intelStatus={null} onSiteAnalysisClick={() => {}} />

      <main className="flex-1 max-w-6xl mx-auto w-full px-8 py-10">
        {/* Session summary */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle size={22} className="text-emerald-400" />
            <h1 className="text-2xl font-bold text-white">Collaboration Session Complete</h1>
          </div>
          <p className="text-muted ml-9">Review your diagrams, export files, and save to the project database.</p>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Left column: stats + actions */}
          <div className="col-span-1 space-y-4">
            {/* Session stats */}
            <div className="bg-panel border border-border rounded-2xl p-5">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">Session Summary</p>
              <div className="space-y-3">
                {[
                  { icon: BedDouble,  label: 'Total Beds',    value: totalBeds.toString(),          color: 'text-emerald-400' },
                  { icon: DollarSign, label: 'Est. Budget',   value: `$${budgetM}M`,                color: 'text-yellow-400' },
                  { icon: Building2,  label: 'Departments',   value: departments.length.toString(), color: 'text-blue-400' },
                  { icon: Layers,     label: 'Diagrams',      value: '7 types',                     color: 'text-purple-400' },
                  { icon: Sparkles,   label: 'Doctor msgs',   value: doctorMsgCount.toString(),     color: 'text-emerald-400' },
                  { icon: Sparkles,   label: 'Arch. msgs',    value: archMsgCount.toString(),       color: 'text-accent' },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon size={13} className={color} />
                      <span className="text-xs text-muted">{label}</span>
                    </div>
                    <span className={`text-sm font-bold ${color}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Export actions */}
            <div className="bg-panel border border-border rounded-2xl p-5">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">Export Options</p>
              <div className="space-y-3">
                {/* Save to DB */}
                <button
                  onClick={handleSaveDB}
                  disabled={saveState === 'saving' || saveState === 'saved'}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                    saveState === 'saved'
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 cursor-default'
                      : saveState === 'saving'
                      ? 'bg-accent/10 border-accent/20 text-accent/60 cursor-wait'
                      : 'bg-accent/15 border-accent/30 text-accent hover:bg-accent/25'
                  }`}
                >
                  {saveState === 'saving' ? <Loader size={16} className="animate-spin" /> :
                   saveState === 'saved'  ? <CheckCircle size={16} /> : <Database size={16} />}
                  {saveState === 'saved' ? 'Saved to Database' :
                   saveState === 'saving' ? 'Saving…' : 'Save to Database'}
                </button>

                {/* Export JSON */}
                <button
                  onClick={handleExportJSON}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-panel hover:bg-card text-sm font-medium text-white transition-colors"
                >
                  <FileJson size={16} className="text-yellow-400" />
                  Export for Revit (JSON)
                </button>

                {/* Export collab log */}
                <button
                  onClick={handleExportCollab}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-panel hover:bg-card text-sm font-medium text-white transition-colors"
                >
                  <FileText size={16} className="text-muted" />
                  Export Collaboration Log
                </button>

                {/* Download PDF */}
                <button
                  onClick={() => window.print()}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-panel hover:bg-card text-sm font-medium text-white transition-colors"
                >
                  <Download size={16} className="text-muted" />
                  Print / Save as PDF
                </button>
              </div>
            </div>

            {/* New session */}
            <button
              onClick={() => navigate('/')}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border text-muted hover:text-white hover:border-accent/40 text-sm transition-colors"
            >
              <RefreshCw size={14} />
              Start New Project
            </button>
          </div>

          {/* Right: diagram preview */}
          <div className="col-span-2">
            {/* Bubble diagram overview */}
            <div className="bg-panel border border-border rounded-2xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-4">
                <Layers size={15} className="text-accent" />
                <span className="text-sm font-semibold text-white">Bubble Diagram</span>
                <span className="text-xs text-muted ml-auto">{departments.length} departments</span>
              </div>
              {bubbleNodes.length > 0 ? (
                <div className="overflow-auto rounded-xl border border-border bg-surface p-3">
                  {(() => {
                    const bounds = bubbleNodes.reduce((b, n) => ({
                      minX: Math.min(b.minX, n.position.x),
                      minY: Math.min(b.minY, n.position.y),
                      maxX: Math.max(b.maxX, n.position.x + (n.data.size || 90)),
                      maxY: Math.max(b.maxY, n.position.y + (n.data.size || 90)),
                    }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity })
                    const vw = bounds.maxX - bounds.minX + 40
                    const vh = bounds.maxY - bounds.minY + 40
                    const scale = Math.min(1, 560 / vw, 260 / vh)
                    return (
                      <svg width={Math.min(560, vw * scale)} height={Math.min(260, vh * scale)}>
                        <g transform={`scale(${scale}) translate(${-bounds.minX + 20} ${-bounds.minY + 20})`}>
                          {bubbleNodes.map(n => {
                            const sz = n.data.size || 90
                            return (
                              <g key={n.id}>
                                <circle
                                  cx={n.position.x + sz / 2} cy={n.position.y + sz / 2} r={sz / 2}
                                  fill={`${n.data.color}20`} stroke={n.data.color} strokeWidth={1.5}
                                />
                                <text x={n.position.x + sz / 2} y={n.position.y + sz / 2 + 4}
                                  textAnchor="middle" fontSize={9} fill={n.data.color} fontWeight={600}>
                                  {(n.data.name || '').split(' ')[0]}
                                </text>
                              </g>
                            )
                          })}
                        </g>
                      </svg>
                    )
                  })()}
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-muted text-sm border border-border rounded-xl">
                  No bubble diagram generated yet
                </div>
              )}
            </div>

            {/* Other diagrams */}
            <div className="bg-panel border border-border rounded-2xl overflow-hidden">
              <div className="flex border-b border-border overflow-x-auto">
                {PREVIEW_TABS.map(tab => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setPreviewTab(tab.id)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                        previewTab === tab.id
                          ? 'text-white border-accent'
                          : 'text-muted border-transparent hover:text-white'
                      }`}
                    >
                      <Icon size={11} />
                      {tab.label}
                    </button>
                  )
                })}
              </div>
              <div className="h-80 overflow-hidden">
                {previewTab === 'stacking'  && <StackingDiagram departments={departments} />}
                {previewTab === 'adjacency' && <AdjacencyMatrix departments={departments} edges={bubbleEdges} />}
                {previewTab === 'workflow'  && <WorkflowDiagram departments={departments} />}
                {previewTab === 'floorplan' && <FloorPlan departments={departments} />}
                {previewTab === 'massing'   && <MassingDiagram departments={departments} />}
                {previewTab === 'roomtypes' && <RoomTypeModule departments={departments} />}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
