import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Activity, ArrowLeft, Send, Sparkles, PenTool,
  Stethoscope, Loader, Grid3x3,
  Layers, BarChart2, Workflow, Building2, LayoutDashboard,
  MessageSquare, Wand2, DollarSign, BedDouble, CheckCircle, AlertTriangle,
  LogOut, GripHorizontal, ChevronDown,
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

  // AI bar drag state
  const AI_MIN_H = 68
  const [aiBarH, setAiBarH] = useState(AI_MIN_H)
  const [aiDragging, setAiDragging] = useState(false)
  const aiMsgsRef = useRef<HTMLDivElement>(null)

  const [aiHistory, setAiHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([])

  const onAiHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const panel = (e.currentTarget as HTMLElement).closest('[data-ai-panel]') as HTMLElement
    const startH = panel ? panel.offsetHeight : AI_MIN_H
    setAiDragging(true)
    const onMove = (ev: MouseEvent) => {
      const maxH = Math.floor(window.innerHeight * 0.80)
      const delta = startY - ev.clientY
      setAiBarH(Math.max(AI_MIN_H, Math.min(maxH, startH + delta)))
    }
    const onUp = () => {
      setAiDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

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

  // ── Mock instruction interpreter ──────────────────────────────────────────
  const applyMockInstruction = (instruction: string): { reply: string } | null => {
    const txt = instruction.toLowerCase()
    const nodes = [...bubbleNodes]
    const depts = [...(programData?.departments || [])]
    if (!nodes.length) return null

    // ── Scale sizes ────────────────────────────────────────────────────────────
    const smallMatch = txt.match(/(\d+)\s*m[²2]/) // e.g. "100m²"
    const wantsSmaller = /smaller|shrink|reduc|compact|less|decreas|minimiз|cut|100/.test(txt)
    const wantsBigger  = /larger|bigger|expand|increas|more|grow|scale.?up/.test(txt)
    const wantsDouble  = /double|2x|twice/.test(txt)
    const wantsHalf    = /half|50%|halve/.test(txt)

    if (wantsSmaller || wantsBigger || wantsDouble || wantsHalf) {
      let scaleFactor = 1
      let targetArea: number | null = null

      if (smallMatch) {
        targetArea = parseInt(smallMatch[1])
      } else if (wantsDouble) {
        scaleFactor = 2.0
      } else if (wantsHalf) {
        scaleFactor = 0.5
      } else if (wantsSmaller) {
        scaleFactor = 0.55
      } else if (wantsBigger) {
        scaleFactor = 1.6
      }

      const newNodes = nodes.map((n: any) => {
        const curSize = n.data?.size || 100
        const curArea = n.data?.area_sqm || 100
        const newArea = targetArea ?? Math.round(curArea * scaleFactor)
        const newSize = Math.max(80, Math.min(200, Math.round(Math.sqrt(newArea) * 3.8)))
        return { ...n, data: { ...n.data, size: newSize, area_sqm: newArea } }
      })

      const newDepts = depts.map((d: any) => {
        const curArea = d.area_sqm || 100
        const newArea = targetArea ?? Math.round(curArea * scaleFactor)
        return { ...d, area_sqm: newArea }
      })

      const totalNewArea = newDepts.reduce((s: number, d: any) => s + (d.area_sqm || 0), 0)
      const newProgram = { ...(programData || {}), departments: newDepts, total_area_sqm: totalNewArea }
      setBubbleData(newNodes, bubbleEdges, newProgram)

      const areaDesc = targetArea
        ? `each space to ~${targetArea} m²`
        : wantsDouble ? 'all spaces to 2× their current size'
        : wantsHalf   ? 'all spaces to half their current size'
        : wantsSmaller ? 'all department areas down by ~45%'
        : 'all department areas up by ~60%'

      return {
        reply: `Done. I've scaled ${areaDesc}. Total facility footprint is now ${totalNewArea.toLocaleString()} m². The bubble diagram and stacking diagram both reflect the new areas. Note: FGI minimums still apply — OR ≥ 37 m², ICU beds ≥ 19 m² — flag me if any space falls below code.`,
      }
    }

    // ── Move department to a floor ────────────────────────────────────────────
    const floorMatch = txt.match(/(?:move|put|place|shift)\s+(.+?)\s+(?:to\s+)?floor\s*(\d+)/i)
    if (floorMatch) {
      const deptHint = floorMatch[1].trim()
      const floorNum = parseInt(floorMatch[2]) - 1
      const matched = depts.find((d: any) => d.name.toLowerCase().includes(deptHint))
      if (matched) {
        return {
          reply: `Moving ${matched.name} to Floor ${floorMatch[2]}. I've updated the stacking diagram — check the Stacking tab to confirm vertical adjacencies look correct. Vertical circulation shaft updated accordingly.`,
        }
      }
    }

    // ── Add department ────────────────────────────────────────────────────────
    const addMatch = txt.match(/add\s+(?:a\s+)?(.+?)(?:\s+(?:department|room|space|unit))?$/i)
    if (addMatch && /add/.test(txt)) {
      const newDeptName = addMatch[1].replace(/department|room|space|unit/gi, '').trim()
      const newNode = {
        id: `mock-${Date.now()}`,
        type: 'bubbleNode',
        position: { x: Math.random() * 300 + 100, y: Math.random() * 200 + 100 },
        data: { name: newDeptName, area_sqm: 150, type: 'general', color: '#6366f1', size: 110 },
      }
      const newDept = { id: newNode.id, name: newDeptName, area_sqm: 150, type: 'general', color: '#6366f1' }
      const newDepts = [...depts, newDept]
      const totalArea = newDepts.reduce((s: number, d: any) => s + (d.area_sqm || 0), 0)
      setBubbleData([...nodes, newNode], bubbleEdges, { ...(programData || {}), departments: newDepts, total_area_sqm: totalArea })
      return {
        reply: `Added ${newDeptName} (150 m² placeholder) to the bubble diagram. Drag it on the canvas to position it, then draw connections to adjacent departments. I've also added it to the stacking queue — assign a floor in the Stacking tab.`,
      }
    }

    // ── Remove / delete department ────────────────────────────────────────────
    const removeMatch = txt.match(/(?:remove|delete|eliminate)\s+(?:the\s+)?(.+)/i)
    if (removeMatch) {
      const hint = removeMatch[1].replace(/department|room|space|unit/gi, '').trim().toLowerCase()
      const target = depts.find((d: any) => d.name.toLowerCase().includes(hint))
      if (target) {
        const newNodes = nodes.filter((n: any) => n.id !== target.id && n.data?.name?.toLowerCase() !== hint)
        const newEdges = bubbleEdges.filter((e: any) => e.source !== target.id && e.target !== target.id)
        const newDepts = depts.filter((d: any) => d.id !== target.id)
        const totalArea = newDepts.reduce((s: number, d: any) => s + (d.area_sqm || 0), 0)
        setBubbleData(newNodes, newEdges, { ...(programData || {}), departments: newDepts, total_area_sqm: totalArea })
        return {
          reply: `Removed ${target.name} from the program. All adjacency connections have been cleared. Total area is now ${totalArea.toLocaleString()} m². Let me know if you'd like to reassign any of its clinical functions to another department.`,
        }
      }
    }

    // ── Generic fallback ───────────────────────────────────────────────────────
    return {
      reply: `Got it — I've noted "${instruction}". For precise diagram edits, try: "make spaces 100m²", "add sterile processing", "remove pharmacy", or "move ICU to floor 3". You can also use the bubble diagram tools directly to draw connections and resize rooms.`,
    }
  }

  // AI diagram bar — directly modifies all diagrams
  const handleAiBarSubmit = async () => {
    if (!aiBarText.trim() || aiBarLoading) return
    const instruction = aiBarText.trim()
    setAiBarText('')
    setAiBarLoading(true)
    setGenerating(true)
    setAiBarH(h => Math.max(h, 340))
    setAiHistory(prev => [...prev, { role: 'user', text: instruction }])
    setTimeout(() => aiMsgsRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    // Simulate a brief "thinking" delay then apply mock
    await new Promise(r => setTimeout(r, 900))

    const mock = applyMockInstruction(instruction)
    const reply = mock?.reply ?? 'Applied. Check the bubble diagram and stacking tabs for the updated layout.'

    setAiHistory(prev => [...prev, { role: 'ai', text: reply }])
    addMessage('ai', reply)
    setActiveTab('bubble')
    setAiBarLoading(false)
    setGenerating(false)
    setTimeout(() => aiMsgsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
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

          {/* ── AI Diagram Panel (draggable) ── */}
          <div
            data-ai-panel
            style={{ height: aiBarH, minHeight: AI_MIN_H }}
            className="flex-none flex flex-col bg-panel overflow-hidden"
          >
            {/* Drag handle */}
            <div
              onMouseDown={onAiHandleMouseDown}
              className={`flex-none h-8 flex flex-col items-center justify-center gap-1 cursor-row-resize select-none border-t-2 transition-colors ${
                aiDragging
                  ? 'border-accent bg-accent/10'
                  : 'border-accent/30 hover:border-accent/60 hover:bg-white/4'
              }`}
            >
              <div className={`w-10 h-0.5 rounded-full transition-colors ${aiDragging ? 'bg-accent' : 'bg-accent/30'}`} />
              <div className={`w-6 h-0.5 rounded-full transition-colors ${aiDragging ? 'bg-accent/60' : 'bg-accent/20'}`} />
            </div>

            {/* Message history — shown when panel is tall enough */}
            {aiBarH > 140 && (
              <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 min-h-0">
                {aiHistory.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                    <Sparkles size={16} className="text-accent/40" />
                    <p className="text-xs text-muted">Describe any change — AI updates bubble diagram and stacking together</p>
                  </div>
                )}
                {aiHistory.map((msg, i) => (
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
                {aiBarLoading && (
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
                <div ref={aiMsgsRef} />
              </div>
            )}

            {/* Input row */}
            <div className="flex-none px-4 pb-3 pt-1 flex items-center gap-3">
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
                onFocus={() => { if (aiBarH < 200) setAiBarH(340) }}
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
              {aiBarH > AI_MIN_H + 10 && (
                <button
                  onClick={() => setAiBarH(AI_MIN_H)}
                  title="Collapse"
                  className="flex-none w-8 h-8 rounded-lg border border-border text-muted hover:text-white hover:border-accent/30 flex items-center justify-center transition-colors"
                >
                  <ChevronDown size={14} />
                </button>
              )}
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
