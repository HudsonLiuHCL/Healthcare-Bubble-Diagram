import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Node, Edge } from '@xyflow/react'
import {
  Activity, ArrowLeft, CheckCircle, Download, RefreshCw,
  ChevronRight, Layers, LayoutGrid
} from 'lucide-react'
import { generateBubble, getBubbles, updateBubble, getProject, exportProject } from '../api/client'
import { useProjectStore } from '../store/projectStore'
import RequirementsChat from '../components/RequirementsChat'
import BubbleCanvas from '../components/BubbleCanvas'

interface Department {
  id: string
  name: string
  area_sqm: number
  type: string
  color: string
  zone?: string
  beds?: number
  description?: string
}

interface BubbleDiagramData {
  id: string
  version: number
  nodes: Node[]
  edges: Edge[]
  requirements_text: string
  program_data: {
    departments?: Department[]
    total_area_sqm?: number
    total_beds?: number
    summary?: string
  }
  status: string
}

export default function BubbleDiagram() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { currentProject, setCurrentProject } = useProjectStore()

  const [activeBubble, setActiveBubble] = useState<BubbleDiagramData | null>(null)
  const [generating, setGenerating] = useState(false)
  const [approving, setApproving] = useState(false)
  const [panel, setPanel] = useState<'requirements' | 'program'>('requirements')

  const nodesRef = useRef<Node[]>([])
  const edgesRef = useRef<Edge[]>([])

  useEffect(() => {
    if (!projectId) return
    if (!currentProject) getProject(projectId).then(setCurrentProject).catch(console.error)
    getBubbles(projectId).then((bubbles: BubbleDiagramData[]) => {
      if (bubbles.length > 0) {
        setActiveBubble(bubbles[0])
        nodesRef.current = bubbles[0].nodes || []
        edgesRef.current = bubbles[0].edges || []
        setPanel('program')
      }
    }).catch(console.error)
  }, [projectId])

  const handleGenerate = async (text: string) => {
    if (!projectId) return
    setGenerating(true)
    try {
      const bubble = await generateBubble(projectId, text)
      setActiveBubble(bubble)
      nodesRef.current = bubble.nodes || []
      edgesRef.current = bubble.edges || []
      setPanel('program')
    } catch (e) {
      alert('Generation failed. Check your OpenAI API key and model.')
      console.error(e)
    } finally {
      setGenerating(false)
    }
  }

  const handleApprove = async () => {
    if (!activeBubble || !projectId) return
    setApproving(true)
    try {
      await updateBubble(projectId, activeBubble.id, {
        nodes: nodesRef.current,
        edges: edgesRef.current,
        status: 'approved',
      })
      setActiveBubble(prev => prev ? { ...prev, status: 'approved' } : null)
    } finally {
      setApproving(false)
    }
  }

  const handleExport = async () => {
    if (!projectId || !currentProject) return
    const data = await exportProject(projectId)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentProject.name.replace(/\s+/g, '_')}_healtharch.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const departments = activeBubble?.program_data?.departments || []
  const totalArea = activeBubble?.program_data?.total_area_sqm
  const totalBeds = activeBubble?.program_data?.total_beds
  const summary = activeBubble?.program_data?.summary

  return (
    <div className="h-screen flex flex-col bg-surface">
      {/* Header */}
      <header className="flex-none border-b border-border px-6 py-3 flex items-center gap-4 z-10">
        <button onClick={() => navigate(`/project/${projectId}/start`)} className="text-muted hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-accent" />
          <span className="text-sm text-muted">{currentProject?.name || 'Project'}</span>
          <span className="text-muted">/</span>
          <span className="text-sm text-white">Bubble Diagram</span>
          {activeBubble && (
            <span className="text-xs text-muted">v{activeBubble.version}</span>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {activeBubble && activeBubble.status !== 'approved' && (
            <button
              onClick={() => setPanel(p => p === 'requirements' ? 'program' : 'requirements')}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-white border border-border hover:border-accent/40 px-3 py-1.5 rounded-lg transition-colors"
            >
              <RefreshCw size={13} />
              Regenerate
            </button>
          )}
          {activeBubble && activeBubble.status !== 'approved' && (
            <button
              onClick={handleApprove}
              disabled={approving}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <CheckCircle size={15} />
              {approving ? 'Approving…' : 'Approve Diagram'}
            </button>
          )}
          {activeBubble?.status === 'approved' && (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-sm text-emerald-400">
                <CheckCircle size={15} />
                Approved
              </span>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                <Download size={15} />
                Export for Revit
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left panel */}
        <div className="w-72 flex-none border-r border-border flex flex-col bg-panel overflow-hidden">
          {/* Panel tabs */}
          {activeBubble && (
            <div className="flex border-b border-border">
              <button
                onClick={() => setPanel('requirements')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors ${panel === 'requirements' ? 'text-white border-b-2 border-accent' : 'text-muted hover:text-white'}`}
              >
                <Layers size={13} />
                Requirements
              </button>
              <button
                onClick={() => setPanel('program')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors ${panel === 'program' ? 'text-white border-b-2 border-accent' : 'text-muted hover:text-white'}`}
              >
                <LayoutGrid size={13} />
                Program
              </button>
            </div>
          )}

          {panel === 'requirements' || !activeBubble ? (
            <RequirementsChat onGenerate={handleGenerate} loading={generating} />
          ) : (
            <div className="flex-1 overflow-y-auto">
              {/* Stats */}
              <div className="px-5 py-4 border-b border-border grid grid-cols-2 gap-3">
                <div className="bg-surface rounded-lg px-3 py-2.5">
                  <div className="text-lg font-bold text-white">{totalArea?.toLocaleString() || '—'}</div>
                  <div className="text-xs text-muted">Total m²</div>
                </div>
                <div className="bg-surface rounded-lg px-3 py-2.5">
                  <div className="text-lg font-bold text-white">{totalBeds || '—'}</div>
                  <div className="text-xs text-muted">Beds</div>
                </div>
              </div>

              {summary && (
                <div className="px-5 py-3 border-b border-border">
                  <p className="text-xs text-muted leading-relaxed">{summary}</p>
                </div>
              )}

              {/* Department list */}
              <div className="px-5 py-3">
                <p className="text-xs font-medium text-muted uppercase tracking-wider mb-3">
                  Departments ({departments.length})
                </p>
                <div className="space-y-2">
                  {departments.map(dept => (
                    <div key={dept.id} className="flex items-center gap-3 py-2">
                      <div
                        className="w-3 h-3 rounded-full flex-none"
                        style={{ backgroundColor: dept.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-white font-medium truncate">{dept.name}</div>
                        <div className="text-xs text-muted">{dept.area_sqm.toLocaleString()} m²
                          {dept.beds ? ` · ${dept.beds} beds` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Canvas */}
        <div className="flex-1 relative">
          {!activeBubble && !generating && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                  <ChevronRight size={32} className="text-purple-400" />
                </div>
                <p className="text-white font-medium mb-1">No diagram yet</p>
                <p className="text-muted text-sm">Enter requirements in the left panel to generate</p>
              </div>
            </div>
          )}
          {generating && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full border-4 border-accent/20 border-t-accent animate-spin mx-auto mb-4" />
                <p className="text-white font-medium mb-1">Generating bubble diagram…</p>
                <p className="text-muted text-sm">AI is analyzing your requirements</p>
              </div>
            </div>
          )}
          {activeBubble && !generating && (
            <BubbleCanvas
              key={activeBubble.id}
              initialNodes={activeBubble.nodes || []}
              initialEdges={activeBubble.edges || []}
              onNodesChange={(nodes) => { nodesRef.current = nodes }}
              onEdgesChange={(edges) => { edgesRef.current = edges }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
