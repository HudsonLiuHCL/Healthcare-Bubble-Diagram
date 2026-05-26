import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Node, Edge } from '@xyflow/react'
import {
  Activity, ArrowLeft, RefreshCw,
  Layers, LayoutGrid, BarChart2, Loader, CheckCircle,
  Database, FileDown,
} from 'lucide-react'
import {
  generateBubble, getBubbles, updateBubble,
  getProject, getIntelligence, refineBubble,
} from '../api/client'
import { useProjectStore } from '../store/projectStore'
import RequirementsChat, { type ChatMessage } from '../components/RequirementsChat'
import BubbleCanvas from '../components/BubbleCanvas'
import SiteIntelligencePanel from '../components/SiteIntelligencePanel'
import { SAMPLE_DIAGRAMS, type SampleDiagram } from '../data/sampleDiagrams'
import { generateProjectPDF, type IntelData } from '../utils/generatePDF'

interface Department {
  id: string; name: string; area_sqm: number; type: string
  color: string; zone?: string; beds?: number; description?: string
}

interface BubbleDiagramData {
  id: string; version: number
  nodes: Node[]; edges: Edge[]
  requirements_text: string
  program_data: { departments?: Department[]; total_area_sqm?: number; total_beds?: number; summary?: string }
  status: string
}

type SaveState = 'idle' | 'saving' | 'saved' | 'pdf'

export default function BubbleDiagram() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { currentProject, setCurrentProject } = useProjectStore()

  const [activeBubble, setActiveBubble] = useState<BubbleDiagramData | null>(null)
  const [generating, setGenerating] = useState(false)
  const [refineLoading, setRefineLoading] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [panel, setPanel] = useState<'requirements' | 'program'>('requirements')
  const [showIntel, setShowIntel] = useState(false)
  const [intelStatus, setIntelStatus] = useState<string | null>(null)
  const [intelData, setIntelData] = useState<IntelData | null>(null)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])

  const nodesRef = useRef<Node[]>([])
  const edgesRef = useRef<Edge[]>([])
  const canvasRef = useRef<HTMLDivElement>(null)

  // Load project + existing bubbles
  useEffect(() => {
    if (!projectId) return
    if (!currentProject) getProject(projectId).then(setCurrentProject).catch(console.error)
    getBubbles(projectId).then((bubbles: BubbleDiagramData[]) => {
      if (bubbles.length > 0) {
        const b = bubbles[0]
        setActiveBubble(b)
        nodesRef.current = b.nodes || []
        edgesRef.current = b.edges || []
        setPanel('program')
        setChatHistory([
          { role: 'user', text: b.requirements_text || 'Loaded existing diagram' },
          {
            role: 'ai',
            text: `Loaded v${b.version} — ${b.program_data?.departments?.length || 0} departments, ${(b.program_data?.total_area_sqm || 0).toLocaleString()} m² total`,
          },
        ])
      }
    }).catch(console.error)
  }, [projectId])

  // Poll intelligence status + store full data
  useEffect(() => {
    if (!projectId) return
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const intel = await getIntelligence(projectId)
        setIntelStatus(intel.status)
        setIntelData(intel)
        if (intel.status !== 'completed' && intel.status !== 'failed') {
          timer = setTimeout(poll, 4000)
        }
      } catch { timer = setTimeout(poll, 5000) }
    }
    poll()
    return () => clearTimeout(timer)
  }, [projectId])

  // Load a pre-built sample diagram (no API call)
  const handleLoadSample = useCallback((diagram: SampleDiagram) => {
    const fakeBubble: BubbleDiagramData = {
      id: `sample-${diagram.id}`,
      version: 1,
      nodes: diagram.nodes as unknown as Node[],
      edges: diagram.edges as unknown as Edge[],
      requirements_text: diagram.prompt,
      program_data: diagram.program_data as BubbleDiagramData['program_data'],
      status: 'draft',
    }
    setActiveBubble(fakeBubble)
    nodesRef.current = fakeBubble.nodes
    edgesRef.current = fakeBubble.edges
    setPanel('program')
    setSaveState('idle')
    setChatHistory([
      { role: 'user', text: `Sample: ${diagram.title}` },
      {
        role: 'ai',
        text: `Loaded ${diagram.nodes.length}-department ${diagram.title} template. Save to database to enable AI refinement.`,
      },
    ])
  }, [])

  // AI-generate bubble diagram
  const handleGenerate = async (text: string) => {
    if (!projectId) return
    setGenerating(true)
    try {
      const bubble = await generateBubble(projectId, text)
      setActiveBubble(bubble)
      nodesRef.current = bubble.nodes || []
      edgesRef.current = bubble.edges || []
      setPanel('program')
      setSaveState('idle')
      setChatHistory([
        { role: 'user', text },
        {
          role: 'ai',
          text: `Generated ${bubble.program_data?.departments?.length || 0} departments — ${(bubble.program_data?.total_area_sqm || 0).toLocaleString()} m² total. Describe any changes below.`,
        },
      ])
    } catch (e) {
      alert('Generation failed. Check your OpenAI API key.')
      console.error(e)
    } finally {
      setGenerating(false)
    }
  }

  // AI-refine existing diagram in-place
  const handleRefine = async (text: string) => {
    if (!activeBubble || !projectId || activeBubble.id.startsWith('sample-')) return
    setRefineLoading(true)
    try {
      const result = await refineBubble(projectId, activeBubble.id, {
        refinement_text: text,
        current_nodes: nodesRef.current,
        current_program: activeBubble.program_data || {},
      })
      setActiveBubble(result)
      nodesRef.current = result.nodes || []
      edgesRef.current = result.edges || []
      setSaveState('idle')
      setChatHistory(prev => [
        ...prev,
        { role: 'user', text },
        {
          role: 'ai',
          text: result.changes_summary || result.program_data?.summary || `Updated to v${result.version}`,
        },
      ])
    } catch (e) {
      console.error(e)
      alert('Refinement failed. Check your OpenAI API key.')
    } finally {
      setRefineLoading(false)
    }
  }

  // Start over — clear diagram and chat
  const handleStartOver = () => {
    setActiveBubble(null)
    setChatHistory([])
    setSaveState('idle')
    setPanel('requirements')
  }

  // Save current diagram to project database, then auto-download PDF
  const handleSave = async () => {
    if (!activeBubble || !projectId) return
    setSaveState('saving')
    try {
      const isSample = activeBubble.id.startsWith('sample-')

      let savedBubble = activeBubble
      if (isSample) {
        const bubble = await generateBubble(projectId, activeBubble.requirements_text)
        await updateBubble(projectId, bubble.id, {
          nodes: nodesRef.current,
          edges: edgesRef.current,
          status: 'approved',
        })
        savedBubble = { ...bubble, nodes: nodesRef.current, edges: edgesRef.current, status: 'approved' }
        setActiveBubble(savedBubble)
        // Now that it's a real diagram, update chat to reflect it's saved
        setChatHistory(prev => [
          ...prev,
          { role: 'ai', text: 'Saved to database. You can now refine this diagram with AI.' },
        ])
      } else {
        await updateBubble(projectId, activeBubble.id, {
          nodes: nodesRef.current,
          edges: edgesRef.current,
          status: 'approved',
        })
        setActiveBubble(prev => prev ? { ...prev, status: 'approved' } : null)
      }

      setSaveState('pdf')

      // Auto-generate and download project PDF
      try {
        await generateProjectPDF(
          currentProject?.name || 'Project',
          savedBubble,
          intelData,
          canvasRef.current,
        )
      } catch (pdfErr) {
        console.warn('PDF generation failed:', pdfErr)
      }

      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 3000)
    } catch (e) {
      console.error(e)
      setSaveState('idle')
      alert('Save failed.')
    }
  }

  const departments = activeBubble?.program_data?.departments || []
  const totalArea = activeBubble?.program_data?.total_area_sqm
  const totalBeds = activeBubble?.program_data?.total_beds
  const summary = activeBubble?.program_data?.summary
  const isSample = activeBubble?.id?.startsWith('sample-')

  return (
    <div className="h-screen flex flex-col bg-surface">
      {/* Header */}
      <header className="flex-none border-b border-border px-6 py-3 flex items-center gap-3 z-10">
        <button onClick={() => navigate(`/project/${projectId}/start`)} className="text-muted hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-accent" />
          <span className="text-sm text-muted">{currentProject?.name || 'Project'}</span>
          <span className="text-muted">/</span>
          <span className="text-sm text-white">Bubble Diagram</span>
          {activeBubble && !isSample && (
            <span className="text-xs text-muted">v{activeBubble.version}</span>
          )}
          {isSample && (
            <span className="text-xs px-2 py-0.5 bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 rounded-full">Sample</span>
          )}
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2 ml-auto">

          {/* Site Intelligence button */}
          <button
            onClick={() => setShowIntel(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              intelStatus === 'completed'
                ? 'border-accent/40 text-accent bg-accent/10 hover:bg-accent/20'
                : intelStatus === 'processing' || intelStatus === 'pending'
                ? 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 animate-pulse'
                : 'border-border text-muted hover:text-white hover:border-accent/30'
            }`}
          >
            <BarChart2 size={13} />
            Site Intel
            {(intelStatus === 'pending' || intelStatus === 'processing') && (
              <Loader size={11} className="animate-spin" />
            )}
            {intelStatus === 'completed' && <CheckCircle size={11} />}
          </button>

          {/* New Diagram */}
          {activeBubble && (
            <button
              onClick={handleStartOver}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-white border border-border hover:border-accent/40 px-3 py-1.5 rounded-lg transition-colors"
            >
              <RefreshCw size={12} />
              New Diagram
            </button>
          )}

          {/* Save + PDF */}
          {activeBubble && (
            <button
              onClick={handleSave}
              disabled={saveState === 'saving' || saveState === 'pdf' || saveState === 'saved'}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                saveState === 'saved'
                  ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 cursor-default'
                  : saveState === 'saving'
                  ? 'bg-accent/50 text-white/60 cursor-wait'
                  : saveState === 'pdf'
                  ? 'bg-purple-600/30 border border-purple-500/30 text-purple-300 cursor-wait'
                  : 'bg-accent hover:bg-accent-hover text-white'
              }`}
            >
              {saveState === 'saved' ? (
                <><CheckCircle size={14} /> Saved &amp; Downloaded</>
              ) : saveState === 'saving' ? (
                <><Loader size={14} className="animate-spin" /> Saving…</>
              ) : saveState === 'pdf' ? (
                <><FileDown size={14} className="animate-bounce" /> Generating PDF…</>
              ) : (
                <><Database size={14} /> Save &amp; Download PDF</>
              )}
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left panel */}
        <div className="w-72 flex-none border-r border-border flex flex-col bg-panel overflow-hidden">
          {/* Tabs — only show when a diagram is active */}
          {activeBubble && (
            <div className="flex border-b border-border flex-none">
              <button
                onClick={() => setPanel('requirements')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors ${panel === 'requirements' ? 'text-white border-b-2 border-accent' : 'text-muted hover:text-white'}`}
              >
                <Layers size={13} />
                Chat
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

          {/* Panel content */}
          {panel === 'requirements' || !activeBubble ? (
            <div className="flex-1 overflow-hidden">
              <RequirementsChat
                onGenerate={handleGenerate}
                onLoadSample={handleLoadSample}
                loading={generating}
                chatHistory={chatHistory}
                onRefine={handleRefine}
                refineLoading={refineLoading}
                onStartOver={handleStartOver}
                isSample={!!isSample}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {/* Program stats */}
              <div className="px-4 py-4 border-b border-border grid grid-cols-2 gap-2">
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
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-xs text-muted leading-relaxed">{summary}</p>
                </div>
              )}

              {/* Department list */}
              <div className="px-4 py-3">
                <p className="text-xs font-medium text-muted uppercase tracking-wider mb-3">
                  Departments ({departments.length})
                </p>
                <div className="space-y-1.5">
                  {departments.map(dept => (
                    <div key={dept.id} className="flex items-center gap-3 py-1.5">
                      <div className="w-3 h-3 rounded-full flex-none" style={{ backgroundColor: dept.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-white font-medium truncate">{dept.name}</div>
                        <div className="text-xs text-muted">
                          {dept.area_sqm.toLocaleString()} m²
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
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                  <Layers size={28} className="text-purple-400" />
                </div>
                <p className="text-white font-medium mb-1">Select a sample or enter requirements</p>
                <p className="text-muted text-sm">Choose a pre-built diagram or describe your facility</p>
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
            <div ref={canvasRef} className="absolute inset-0">
              <BubbleCanvas
                key={activeBubble.id}
                initialNodes={activeBubble.nodes || []}
                initialEdges={activeBubble.edges || []}
                onNodesChange={(nodes) => { nodesRef.current = nodes }}
                onEdgesChange={(edges) => { edgesRef.current = edges }}
              />
            </div>
          )}

          {/* Refine loading overlay */}
          {refineLoading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
              <div className="bg-surface border border-border rounded-2xl px-6 py-5 text-center shadow-2xl">
                <div className="w-10 h-10 rounded-full border-4 border-accent/20 border-t-accent animate-spin mx-auto mb-3" />
                <p className="text-white text-sm font-medium">Refining diagram…</p>
                <p className="text-muted text-xs mt-1">AI is applying your changes</p>
              </div>
            </div>
          )}

          {/* Intelligence status overlay chip */}
          {intelStatus && (
            <div
              className={`absolute top-4 left-4 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium cursor-pointer transition-all shadow-lg ${
                intelStatus === 'completed'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                  : intelStatus === 'failed'
                  ? 'border-red-500/30 bg-red-500/10 text-red-400'
                  : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
              }`}
              onClick={() => intelStatus === 'completed' && setShowIntel(true)}
            >
              {intelStatus === 'completed' ? (
                <><CheckCircle size={13} /> Site Intelligence Ready — click to view</>
              ) : intelStatus === 'failed' ? (
                <>⚠ Site analysis incomplete</>
              ) : (
                <><Loader size={13} className="animate-spin" /> Gathering site intelligence…</>
              )}
            </div>
          )}
        </div>
      </div>

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
