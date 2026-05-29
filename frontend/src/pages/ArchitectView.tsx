import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Activity, ArrowLeft, Send, Sparkles, PenTool,
  Stethoscope, Loader, Grid3x3,
  Layers, BarChart2, Workflow, Building2, LayoutDashboard,
  MessageSquare, Wand2, DollarSign, BedDouble, CheckCircle, AlertTriangle,
  LogOut,
} from 'lucide-react'
import { generateBubble, getProject, getIntelligence } from '../api/client'
import { collaborateChat } from '../api/client'
import StepChain from '../components/StepChain'
import SiteIntelligencePanel from '../components/SiteIntelligencePanel'
import { useProjectStore } from '../store/projectStore'
import { useCollabStore, type MessageRole } from '../store/collabStore'
import { SAMPLE_DIAGRAMS } from '../data/sampleDiagrams'
import BubbleCanvas from '../components/BubbleCanvas'
import AdjacencyMatrix from '../components/diagrams/AdjacencyMatrix'
import StackingDiagram from '../components/diagrams/StackingDiagram'
import WorkflowDiagram from '../components/diagrams/WorkflowDiagram'
import FloorPlan from '../components/diagrams/FloorPlan'
import MassingDiagram from '../components/diagrams/MassingDiagram'
import RoomTypeModule from '../components/diagrams/RoomTypeModule'

type DiagramTab = 'bubble' | 'adjacency' | 'stacking' | 'workflow' | 'floorplan' | 'massing' | 'roomtypes'

const TABS: { id: DiagramTab; label: string; icon: React.ElementType }[] = [
  { id: 'bubble',    label: 'Bubble',     icon: Layers },
  { id: 'adjacency', label: 'Adjacency',  icon: Grid3x3 },
  { id: 'stacking',  label: 'Stacking',   icon: BarChart2 },
  { id: 'workflow',  label: 'Workflow',   icon: Workflow },
  { id: 'floorplan', label: 'Floor Plan', icon: LayoutDashboard },
  { id: 'massing',   label: 'Massing',    icon: Building2 },
  { id: 'roomtypes', label: 'Room Types', icon: Grid3x3 },
]

const ROLE_STYLE: Record<MessageRole, { bg: string; label: string; icon: React.ElementType; color: string }> = {
  doctor:   { bg: 'bg-emerald-500/15 border-emerald-500/30', label: 'Doctor',    icon: Stethoscope, color: 'text-emerald-400' },
  architect:{ bg: 'bg-accent/15 border-accent/30',           label: 'Architect', icon: PenTool,     color: 'text-accent' },
  ai:       { bg: 'bg-purple-500/10 border-purple-500/25',   label: 'AI',        icon: Sparkles,    color: 'text-purple-400' },
}

const MOCK_MESSAGES = [
  { role: 'doctor' as MessageRole,    text: 'We need the ICU immediately adjacent to the surgery suite — our transfer time is currently 8 minutes and that\'s too long for post-op critical patients.', timestamp: Date.now() - 600000 },
  { role: 'ai' as MessageRole,        text: 'Noted. FGI 2.2-3.2 requires ICU rooms ≥ 200 SF/bed. Placing ICU adjacent to surgery also satisfies the sterile corridor requirement. I\'ve flagged this as a "must-adjacent" constraint in the adjacency matrix.', timestamp: Date.now() - 590000 },
  { role: 'architect' as MessageRole, text: 'Understood. I\'ve positioned ICU on Floor 3 directly above surgery (Floor 2) with a dedicated patient elevator. The stacking diagram reflects this now.', timestamp: Date.now() - 580000 },
  { role: 'doctor' as MessageRole,    text: 'What about the ED? We process about 180 patients per day. And we need direct access to radiology — CT scans are time-critical for stroke protocols.', timestamp: Date.now() - 480000 },
  { role: 'ai' as MessageRole,        text: 'For 180 ED visits/day, guidelines recommend 20–25 treatment bays at ~120 SF each. ED→Imaging adjacency is classified as "must-adjacent" in the bubble diagram. Current layout shows this connection.', timestamp: Date.now() - 470000 },
  { role: 'architect' as MessageRole, text: 'ED and Radiology are both on Floor 1 with a direct internal corridor. I\'ll expand the ED bay count to 22 to meet your volume.', timestamp: Date.now() - 460000 },
]

function buildMockMessages() {
  return MOCK_MESSAGES.map((m, i) => ({ ...m, id: `mock-${i}` }))
}

const FGI_ITEMS = [
  { ok: true,  label: 'ICU ≥ 200 SF/bed (FGI 2.1-2.2.3)' },
  { ok: true,  label: 'ED bays ≥ 120 SF each (FGI 2.2-3.2)' },
  { ok: true,  label: 'OR ≥ 400 SF general (FGI 2.3-3.4)' },
  { ok: true,  label: 'Private inpatient rooms ≥ 120 SF' },
  { ok: false, label: 'Sterile processing adjacency — verify' },
]

export default function ArchitectView() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { currentProject, setCurrentProject } = useProjectStore()
  const {
    init, messages, bubbleNodes, bubbleEdges, programData,
    generating, addMessage, setBubbleData, setGenerating, hydrateMock,
    comments,
  } = useCollabStore()

  const [activeTab, setActiveTab] = useState<DiagramTab>('bubble')
  const [collabText, setCollabText] = useState('')
  const [aiBarText, setAiBarText] = useState('')
  const [collabLoading, setCollabLoading] = useState(false)
  const [aiBarLoading, setAiBarLoading] = useState(false)
  const [showIntel, setShowIntel] = useState(false)
  const [intelStatus, setIntelStatus] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const nodesRef = useRef(bubbleNodes)
  const edgesRef = useRef(bubbleEdges)

  useEffect(() => {
    if (!projectId) return
    init(projectId)
    if (!currentProject) getProject(projectId).then(setCurrentProject).catch(console.error)
    // Poll site intelligence status
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

  // Auto-load mock data if store is empty after a tick
  useEffect(() => {
    if (!projectId) return
    const timer = setTimeout(() => {
      const { bubbleNodes: bn } = useCollabStore.getState()
      if (bn.length === 0) {
        const sample = SAMPLE_DIAGRAMS[0]
        const mockNodes = sample.nodes.map(n => ({ ...n }))
        const mockEdges = sample.edges.map(e => ({ ...e }))
        hydrateMock(mockNodes, mockEdges, sample.program_data, buildMockMessages())
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [projectId])

  useEffect(() => {
    nodesRef.current = bubbleNodes
    edgesRef.current = bubbleEdges
  }, [bubbleNodes, bubbleEdges])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Send a collaboration message (visible to doctor too)
  const handleCollabSend = async () => {
    if (!collabText.trim() || collabLoading) return
    const msg = collabText.trim()
    setCollabText('')
    addMessage('architect', msg)
    setCollabLoading(true)
    try {
      const { response } = await collaborateChat({
        role: 'architect',
        message: msg,
        history: messages.slice(-12).map(m => ({ role: m.role, text: m.text })),
      })
      addMessage('ai', response)
    } catch {
      addMessage('ai', 'AI unavailable — message sent to team.')
    } finally {
      setCollabLoading(false)
    }
  }

  // AI diagram bar — directly modifies all diagrams
  const handleAiBarSubmit = async () => {
    if (!projectId || !aiBarText.trim() || aiBarLoading) return
    const instruction = aiBarText.trim()
    setAiBarText('')
    setAiBarLoading(true)
    setGenerating(true)
    addMessage('ai', `Applying diagram change: "${instruction}"…`)
    try {
      const context = programData?.summary
        ? `Current program: ${programData.summary}\n\nModification requested: ${instruction}`
        : instruction
      const bubble = await generateBubble(projectId, context)
      setBubbleData(bubble.nodes || [], bubble.edges || [], bubble.program_data || {})
      const deptCount = bubble.program_data?.departments?.length || 0
      addMessage('ai', `Diagrams updated — ${deptCount} departments revised per your instruction.`)
      setActiveTab('bubble')
    } catch {
      addMessage('ai', 'Diagram update failed. Check API key and try again.')
    } finally {
      setAiBarLoading(false)
      setGenerating(false)
    }
  }

  const departments = programData?.departments || []
  const totalArea = programData?.total_area_sqm || 0
  const totalBeds = programData?.total_beds || 0
  const budgetM = totalArea > 0 ? Math.round((totalArea * 4800) / 1_000_000) : null

  // Comment count per tab
  const commentCount = (tab: DiagramTab) => comments.filter(c => c.diagramTab === tab).length

  return (
    <div className="h-screen flex flex-col bg-surface overflow-hidden">
      {/* Header */}
      <header className="flex-none border-b border-border px-5 py-2.5 flex items-center gap-3">
        <button onClick={() => navigate(`/project/${projectId}/collaborate`)} className="text-muted hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-accent" />
          <span className="text-xs text-muted">{currentProject?.name || 'Project'}</span>
          <span className="text-muted">/</span>
          <PenTool size={13} className="text-accent" />
          <span className="text-xs text-white font-medium">Architect View</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs px-3 py-1 rounded-full bg-accent/15 border border-accent/30 text-accent font-medium">Design Team</span>
          {departments.length > 0 && (
            <span className="text-xs text-muted">{departments.length} depts · {totalArea.toLocaleString()} m²</span>
          )}
          <button
            onClick={() => navigate(`/project/${projectId}/export`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-600/30 text-xs font-medium transition-colors"
          >
            <LogOut size={12} /> End Session
          </button>
        </div>
      </header>
      <StepChain current="collab" projectId={projectId} intelStatus={intelStatus} onSiteAnalysisClick={() => setShowIntel(true)} />

      <div className="flex-1 flex overflow-hidden">
        {/* ── Left: Team collaboration chat ── */}
        <div className="w-64 flex-none border-r border-border flex flex-col bg-panel">
          <div className="flex-none px-4 py-2.5 border-b border-border flex items-center gap-2">
            <MessageSquare size={13} className="text-emerald-400" />
            <span className="text-xs font-semibold text-white">Team Chat</span>
            <span className="text-xs text-muted ml-auto">Doctor ↔ Architect</span>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Stethoscope size={20} className="text-muted mx-auto mb-2" />
                <p className="text-xs text-muted">Waiting for the doctor to join…</p>
              </div>
            )}
            {messages.map(msg => {
              const style = ROLE_STYLE[msg.role]
              const Icon = style.icon
              return (
                <div key={msg.id} className="flex gap-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-none mt-0.5 ${
                    msg.role === 'ai' ? 'bg-purple-500/20' : msg.role === 'doctor' ? 'bg-emerald-500/20' : 'bg-accent/20'
                  }`}>
                    <Icon size={9} className={style.color} />
                  </div>
                  <div>
                    <span className={`text-xs font-semibold ${style.color}`}>{style.label}</span>
                    <div className={`mt-0.5 rounded-xl rounded-tl-sm px-2.5 py-1.5 text-xs leading-relaxed border ${style.bg} text-white/90`}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              )
            })}
            {collabLoading && (
              <div className="flex gap-2">
                <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center flex-none">
                  <Sparkles size={9} className="text-purple-400" />
                </div>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl px-3 py-2 flex gap-1">
                  {[0,1,2].map(i => <div key={i} className="w-1 h-1 rounded-full bg-purple-400 animate-bounce" style={{animationDelay:`${i*0.15}s`}} />)}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Collaboration input */}
          <div className="flex-none px-3 py-3 border-t border-border">
            <textarea
              value={collabText}
              onChange={e => setCollabText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleCollabSend() }}
              placeholder="Reply to doctor… (⌘↵)"
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-white placeholder-muted resize-none focus:outline-none focus:border-accent leading-relaxed mb-2"
              rows={2}
            />
            <button
              onClick={handleCollabSend}
              disabled={collabLoading || !collabText.trim()}
              className="flex items-center justify-center gap-1.5 w-full bg-accent hover:bg-accent-hover disabled:opacity-40 text-white py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              <Send size={11} /> Send as Architect
            </button>
          </div>
        </div>

        {/* ── Center: Diagram workspace ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Diagram type tabs */}
          <div className="flex-none border-b border-border flex bg-panel overflow-x-auto">
            {TABS.map(tab => {
              const Icon = tab.icon
              const cnt = commentCount(tab.id)
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? 'text-white border-accent bg-accent/8'
                      : 'text-muted border-transparent hover:text-white hover:bg-card'
                  }`}
                >
                  <Icon size={11} />
                  {tab.label}
                  {cnt > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center font-bold" style={{fontSize:8}}>
                      {cnt}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Active diagram content */}
          <div className="flex-1 overflow-hidden bg-surface relative">
            {generating && (
              <div className="absolute inset-0 bg-surface/80 flex items-center justify-center z-20">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full border-4 border-accent/20 border-t-accent animate-spin mx-auto mb-3" />
                  <p className="text-white font-medium text-sm">Updating diagrams…</p>
                  <p className="text-muted text-xs mt-1">AI is applying your changes</p>
                </div>
              </div>
            )}

            {activeTab === 'bubble' && (
              <div className="absolute inset-0">
                {bubbleNodes.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Layers size={28} className="text-muted mx-auto mb-3" />
                      <p className="text-white text-sm font-medium">Loading mock data…</p>
                    </div>
                  </div>
                ) : (
                  <BubbleCanvas
                    key={`bubble-${bubbleNodes.length}`}
                    initialNodes={bubbleNodes}
                    initialEdges={bubbleEdges}
                    onNodesChange={nodes => { nodesRef.current = nodes }}
                    onEdgesChange={edges => { edgesRef.current = edges }}
                  />
                )}
              </div>
            )}
            {activeTab === 'adjacency' && <AdjacencyMatrix departments={departments} edges={bubbleEdges} />}
            {activeTab === 'stacking'   && <StackingDiagram departments={departments} />}
            {activeTab === 'workflow'   && <WorkflowDiagram departments={departments} />}
            {activeTab === 'floorplan'  && <FloorPlan departments={departments} />}
            {activeTab === 'massing'    && <MassingDiagram departments={departments} />}
            {activeTab === 'roomtypes'  && <RoomTypeModule departments={departments} />}
          </div>

          {/* ── AI Diagram Bar (bottom of canvas) ── */}
          <div className="flex-none border-t-2 border-accent/30 bg-panel px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-none">
                <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center">
                  <Wand2 size={14} className="text-accent" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-accent leading-none">AI Design Tool</div>
                  <div className="text-xs text-muted leading-none mt-0.5">Edits all diagrams</div>
                </div>
              </div>
              <input
                value={aiBarText}
                onChange={e => setAiBarText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAiBarSubmit() }}
                placeholder='Describe a change… e.g. "Add sterile processing adjacent to surgery" or "Move imaging to floor 2"'
                className="flex-1 bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-muted focus:outline-none focus:border-accent transition-colors"
              />
              <button
                onClick={handleAiBarSubmit}
                disabled={aiBarLoading || !aiBarText.trim()}
                className="flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors flex-none"
              >
                {aiBarLoading ? <Loader size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {aiBarLoading ? 'Updating…' : 'Update'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: Program data ── */}
        <div className="w-56 flex-none border-l border-border flex flex-col bg-panel overflow-hidden">
          <div className="flex-none px-4 py-2.5 border-b border-border">
            <span className="text-xs font-semibold text-white">Program Data</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {/* Key metrics */}
            <div className="px-4 py-3 border-b border-border space-y-2.5">
              <div className="bg-surface rounded-lg px-3 py-2.5 flex items-center gap-2.5">
                <DollarSign size={14} className="text-yellow-400 flex-none" />
                <div>
                  <div className="text-base font-bold text-yellow-400">{budgetM ? `$${budgetM}M` : '—'}</div>
                  <div className="text-xs text-muted">Est. Budget</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface rounded-lg px-3 py-2.5">
                  <div className="text-base font-bold text-white">{totalArea ? totalArea.toLocaleString() : '—'}</div>
                  <div className="text-xs text-muted">m² Total</div>
                </div>
                <div className="bg-surface rounded-lg px-3 py-2.5">
                  <div className="text-base font-bold text-white">{totalBeds || '—'}</div>
                  <div className="text-xs text-muted flex items-center gap-1"><BedDouble size={9} />Beds</div>
                </div>
              </div>
            </div>

            {/* Summary */}
            {programData?.summary && (
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs text-muted leading-relaxed">{programData.summary}</p>
              </div>
            )}

            {/* FGI compliance */}
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">FGI Compliance</p>
              <div className="space-y-1.5">
                {FGI_ITEMS.map(item => (
                  <div key={item.label} className="flex items-start gap-1.5">
                    {item.ok
                      ? <CheckCircle size={11} className="text-emerald-400 flex-none mt-0.5" />
                      : <AlertTriangle size={11} className="text-yellow-400 flex-none mt-0.5" />}
                    <span className="text-xs text-muted leading-tight">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Department list */}
            <div className="px-4 py-3">
              <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
                Departments ({departments.length})
              </p>
              <div className="space-y-1.5">
                {departments.map(d => (
                  <div key={d.id} className="flex items-center gap-2 py-0.5">
                    <div className="w-2 h-2 rounded-full flex-none" style={{ backgroundColor: d.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white truncate">{d.name}</div>
                      <div className="text-xs text-muted">{d.area_sqm?.toLocaleString()} m²{d.beds ? ` · ${d.beds}bd` : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {projectId && (
        <SiteIntelligencePanel isOpen={showIntel} onClose={() => setShowIntel(false)} projectId={projectId} />
      )}
    </div>
  )
}
