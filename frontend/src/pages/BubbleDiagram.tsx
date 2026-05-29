import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Node, Edge } from '@xyflow/react'
import {
  Activity, ArrowLeft, RefreshCw, GripHorizontal,
  BarChart2, Loader, CheckCircle, Sparkles,
  Database, FileDown, Send, ChevronDown,
} from 'lucide-react'
import {
  generateBubble, getBubbles, updateBubble,
  getProject, getIntelligence, refineBubble, publishProject,
} from '../api/client'
import { useProjectStore } from '../store/projectStore'
import { useAuthStore } from '../store/authStore'
import { type ChatMessage } from '../components/RequirementsChat'
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
  const { idToken } = useAuthStore()
  const [publishState, setPublishState] = useState<'idle' | 'publishing' | 'published' | 'error'>('idle')

  const [activeBubble, setActiveBubble] = useState<BubbleDiagramData | null>(null)
  const [generating, setGenerating] = useState(false)
  const [refineLoading, setRefineLoading] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [showIntel, setShowIntel] = useState(false)
  const [intelStatus, setIntelStatus] = useState<string | null>(null)
  const [intelData, setIntelData] = useState<IntelData | null>(null)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')

  // Chat drawer drag state
  const MIN_CHAT_H = 68
  const [chatH, setChatH] = useState(68)
  const [dragging, setDragging] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  const nodesRef = useRef<Node[]>([])
  const edgesRef = useRef<Edge[]>([])
  const canvasRef = useRef<HTMLDivElement>(null)

  // Drag handler — no dependency on chatH; captures startH at mousedown
  const onHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    // Read current height from the DOM to avoid stale closure
    const panel = (e.currentTarget as HTMLElement).closest('[data-chat-panel]') as HTMLElement
    const startH = panel ? panel.offsetHeight : 68
    setDragging(true)

    const onMove = (ev: MouseEvent) => {
      const maxH = Math.floor(window.innerHeight * 0.82)
      const delta = startY - ev.clientY
      setChatH(prev => Math.max(MIN_CHAT_H, Math.min(maxH, startH + delta)))
    }
    const onUp = () => {
      setDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

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
        setChatH(280)
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
    setChatH(280)
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
      setChatH(280)
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
    setChatH(64)
  }

  // Unified chat send — generates if no diagram, refines if one exists
  const handleChatSend = async () => {
    const text = chatInput.trim()
    if (!text || generating || refineLoading) return
    setChatInput('')
    if (!activeBubble) {
      await handleGenerate(text)
    } else {
      await handleRefine(text)
    }
    // Auto-expand chat to show response
    setChatH(h => Math.max(h, 320))
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const handleChatKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleChatSend()
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

  // Publish this project to the Revit handoff store (needs a Google sign-in).
  async function handlePublish() {
    if (!projectId || !idToken) return
    setPublishState('publishing')
    try {
      await publishProject(projectId, idToken)
      setPublishState('published')
      setTimeout(() => setPublishState('idle'), 3000)
    } catch (err) {
      console.error('Publish to Revit failed', err)
      setPublishState('error')
      setTimeout(() => setPublishState('idle'), 3000)
    }
  }

  const isLoading = generating || refineLoading
  const isSample = activeBubble?.id?.startsWith('sample-')
  const departments = activeBubble?.program_data?.departments || []
  const totalArea = activeBubble?.program_data?.total_area_sqm
  const totalBeds = activeBubble?.program_data?.total_beds

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

          {/* Send to Revit (publish to the handoff store) */}
          {activeBubble && (
            <button
              onClick={handlePublish}
              disabled={!idToken || publishState === 'publishing'}
              title={idToken ? 'Publish this project to Revit' : 'Sign in with Google (top-right) first'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                publishState === 'published'
                  ? 'border-emerald-500/30 text-emerald-400 bg-emerald-600/10'
                  : publishState === 'error'
                  ? 'border-red-500/30 text-red-400 bg-red-600/10'
                  : 'border-border text-muted hover:text-white hover:border-accent/40'
              }`}
            >
              {publishState === 'publishing' ? <Loader size={13} className="animate-spin" /> : <Send size={13} />}
              {publishState === 'publishing' ? 'Sending…'
                : publishState === 'published' ? 'Sent to Revit ✓'
                : publishState === 'error' ? 'Failed'
                : 'Send to Revit'}
            </button>
          )}
        </div>
      </header>

      {/* Body: canvas + chat drawer */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Canvas (full width, shrinks as chat expands) ── */}
        <div className="flex-1 relative overflow-hidden">
          {/* Empty state */}
          {!activeBubble && !generating && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 pointer-events-none">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-accent/15 flex items-center justify-center mx-auto mb-4">
                  <Sparkles size={28} className="text-accent" />
                </div>
                <p className="text-white font-medium mb-1">Describe your facility below</p>
                <p className="text-muted text-sm">Type requirements in the chat bar — AI will generate your bubble diagram</p>
              </div>
              {/* Sample quick-picks */}
              <div className="flex gap-2 flex-wrap justify-center pointer-events-auto">
                {SAMPLE_DIAGRAMS.slice(0, 3).map(d => (
                  <button
                    key={d.id}
                    onClick={() => handleLoadSample(d)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-border bg-panel text-muted hover:text-white hover:border-accent/40 transition-all"
                  >
                    {d.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Generating spinner */}
          {generating && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full border-4 border-accent/20 border-t-accent animate-spin mx-auto mb-4" />
                <p className="text-white font-medium mb-1">Generating bubble diagram…</p>
                <p className="text-muted text-sm">AI is analyzing your requirements</p>
              </div>
            </div>
          )}

          {/* Bubble canvas */}
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

          {/* Refine overlay */}
          {refineLoading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
              <div className="bg-surface border border-border rounded-2xl px-6 py-5 text-center shadow-2xl">
                <div className="w-10 h-10 rounded-full border-4 border-accent/20 border-t-accent animate-spin mx-auto mb-3" />
                <p className="text-white text-sm font-medium">AI is updating your diagram…</p>
                <p className="text-muted text-xs mt-1">Bubble diagram + stacking will both refresh</p>
              </div>
            </div>
          )}

          {/* Site intel chip */}
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
                <><CheckCircle size={13} /> Site Intelligence Ready</>
              ) : intelStatus === 'failed' ? (
                <>⚠ Site analysis incomplete</>
              ) : (
                <><Loader size={13} className="animate-spin" /> Gathering site intelligence…</>
              )}
            </div>
          )}

          {/* Stats pill (top-right of canvas) */}
          {activeBubble && (totalArea || totalBeds) && (
            <div className="absolute top-4 right-4 flex items-center gap-3 px-3 py-2 rounded-xl bg-surface/80 border border-border/60 backdrop-blur-sm text-xs text-muted">
              {totalArea && <span><span className="text-white font-semibold">{totalArea.toLocaleString()}</span> m²</span>}
              {totalBeds && <span><span className="text-white font-semibold">{totalBeds}</span> beds</span>}
              {departments.length > 0 && <span><span className="text-white font-semibold">{departments.length}</span> depts</span>}
            </div>
          )}
        </div>

        {/* ── AI Chat Drawer ── */}
        <div
          data-chat-panel
          style={{ height: chatH, minHeight: MIN_CHAT_H }}
          className="flex-none flex flex-col bg-panel overflow-hidden"
        >
          {/* Drag handle — full-width resize bar */}
          <div
            onMouseDown={onHandleMouseDown}
            className={`flex-none h-8 flex flex-col items-center justify-center gap-1 cursor-row-resize select-none border-t-2 transition-colors ${
              dragging
                ? 'border-accent bg-accent/10'
                : 'border-border hover:border-accent/50 hover:bg-white/4'
            }`}
          >
            <div className={`w-10 h-0.5 rounded-full transition-colors ${dragging ? 'bg-accent' : 'bg-border group-hover:bg-muted/60'}`} />
            <div className={`w-6 h-0.5 rounded-full transition-colors ${dragging ? 'bg-accent/60' : 'bg-border/60'}`} />
          </div>

          {/* Message history — visible when tall enough */}
          {chatH > 140 && (
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 min-h-0">
              {chatHistory.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                  <Sparkles size={18} className="text-accent/50" />
                  <p className="text-xs text-muted">Ask AI to generate or modify your diagrams</p>
                  <p className="text-xs text-muted/60">Changes apply to both bubble diagram and stacking diagram</p>
                </div>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'ai' && (
                    <div className="w-6 h-6 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center flex-none mt-0.5">
                      <Sparkles size={10} className="text-accent" />
                    </div>
                  )}
                  <div className={`max-w-[72%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-accent/20 border border-accent/30 text-white rounded-br-sm'
                      : 'bg-surface border border-border text-slate-300 rounded-bl-sm'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-2.5 justify-start">
                  <div className="w-6 h-6 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center flex-none">
                    <Sparkles size={10} className="text-accent" />
                  </div>
                  <div className="bg-surface border border-border rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>
          )}

          {/* Input row */}
          <div className="flex-none px-4 pb-3 pt-1 flex items-end gap-2">
            {isSample && (
              <div className="flex-1 text-xs text-yellow-400/80 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2">
                Save diagram first to enable AI refinement
              </div>
            )}
            {!isSample && (
              <textarea
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={handleChatKey}
                onFocus={() => { if (chatH < 200) setChatH(280) }}
                placeholder={
                  activeBubble
                    ? 'Ask AI to adjust rooms, add a department, change the stacking… (⌘↵ to send)'
                    : 'Describe your healthcare facility — departments, bed count, workflows… (⌘↵ to send)'
                }
                rows={1}
                style={{ resize: 'none', minHeight: 36, maxHeight: 120 }}
                className="flex-1 bg-surface border border-border rounded-xl px-3 py-2 text-xs text-white placeholder-muted focus:outline-none focus:border-accent leading-relaxed overflow-y-auto"
              />
            )}
            <button
              onClick={handleChatSend}
              disabled={isLoading || !chatInput.trim() || !!isSample}
              className="flex-none w-9 h-9 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors"
            >
              {isLoading
                ? <Loader size={14} className="animate-spin" />
                : <Send size={14} />
              }
            </button>
            {chatH > MIN_CHAT_H + 10 && (
              <button
                onClick={() => setChatH(MIN_CHAT_H)}
                title="Collapse chat"
                className="flex-none w-9 h-9 rounded-xl border border-border text-muted hover:text-white hover:border-accent/30 flex items-center justify-center transition-colors"
              >
                <ChevronDown size={14} />
              </button>
            )}
          </div>
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
