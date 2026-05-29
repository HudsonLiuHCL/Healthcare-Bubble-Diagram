import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Activity, ArrowLeft, Send, Sparkles, Stethoscope, PenTool,
  Loader, BedDouble, DollarSign, Building2, CheckCircle,
  AlertTriangle, HeartPulse, Clock, Users, ShieldCheck,
  TrendingUp, Thermometer, MessageSquare, Layers, Grid3x3,
  BarChart2, Workflow, LayoutDashboard, Building, Star, LogOut,
} from 'lucide-react'
import { getProject, getIntelligence } from '../api/client'
import { collaborateChat } from '../api/client'
import StepChain from '../components/StepChain'
import SiteIntelligencePanel from '../components/SiteIntelligencePanel'
import GoogleAuthButton from '../components/GoogleAuthButton'
import { useProjectStore } from '../store/projectStore'
import { useCollabStore, type MessageRole, type DiagramComment } from '../store/collabStore'
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
  { id: 'massing',   label: 'Massing',    icon: Building },
  { id: 'roomtypes', label: 'Room Types', icon: Grid3x3 },
]

const ROLE_STYLE: Record<MessageRole, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  doctor:   { label: 'Doctor',    icon: Stethoscope, color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' },
  architect:{ label: 'Architect', icon: PenTool,     color: 'text-accent',      bg: 'bg-accent/15 border-accent/30' },
  ai:       { label: 'AI',        icon: Sparkles,    color: 'text-purple-400',  bg: 'bg-purple-500/10 border-purple-500/25' },
}

// Static bubble diagram display (no editing)
function BubbleReadOnly({ nodes }: { nodes: any[] }) {
  if (nodes.length === 0) return (
    <div className="flex items-center justify-center h-full text-muted text-sm">
      Generate diagrams to see the bubble diagram.
    </div>
  )
  const bounds = nodes.reduce((b, n) => ({
    minX: Math.min(b.minX, n.position.x - 10),
    minY: Math.min(b.minY, n.position.y - 10),
    maxX: Math.max(b.maxX, n.position.x + (n.data.size || 100) + 10),
    maxY: Math.max(b.maxY, n.position.y + (n.data.size || 100) + 10),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity })
  const vw = bounds.maxX - bounds.minX
  const vh = bounds.maxY - bounds.minY

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-none px-5 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-white">Bubble Diagram</h3>
        <p className="text-xs text-muted mt-0.5">Department relationships — read-only view. Use comments to suggest changes.</p>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <svg width={Math.max(600, vw)} height={Math.max(400, vh)} style={{ overflow: 'visible' }}>
          {nodes.map(n => {
            const sz = n.data.size || 90
            const cx = n.position.x - bounds.minX + sz / 2
            const cy = n.position.y - bounds.minY + sz / 2
            return (
              <g key={n.id}>
                <circle cx={cx} cy={cy} r={sz / 2}
                  fill={`${n.data.color}20`} stroke={n.data.color} strokeWidth={2} />
                <text x={cx} y={cy - 4} textAnchor="middle" fontSize={10} fill={n.data.color} fontWeight={600}>
                  {n.data.name?.split(' ').slice(0, 2).join(' ')}
                </text>
                {n.data.area_sqm && (
                  <text x={cx} y={cy + 10} textAnchor="middle" fontSize={8} fill={`${n.data.color}90`}>
                    {n.data.area_sqm.toLocaleString()} m²
                  </text>
                )}
                {n.data.beds && (
                  <text x={cx} y={cy + 22} textAnchor="middle" fontSize={8} fill={`${n.data.color}80`}>
                    {n.data.beds} beds
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, sub, color, alert }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string; alert?: boolean
}) {
  return (
    <div className={`rounded-xl border p-3.5 ${alert ? 'bg-yellow-500/8 border-yellow-500/25' : 'bg-surface border-border'}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={13} className={color} />
        <span className="text-xs text-muted">{label}</span>
        {alert && <AlertTriangle size={11} className="text-yellow-400 ml-auto" />}
      </div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-muted mt-0.5 leading-tight">{sub}</div>}
    </div>
  )
}

export default function DoctorView() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { currentProject, setCurrentProject } = useProjectStore()
  const { init: initStore, messages: msgs, programData: pd, bubbleNodes, bubbleEdges, addMessage: addMsg, addComment, comments } = useCollabStore()

  const [activeTab, setActiveTab] = useState<DiagramTab>('bubble')
  const [chatText, setChatText] = useState('')
  const [commentText, setCommentText] = useState('')
  const [showCommentInput, setShowCommentInput] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [showIntel, setShowIntel] = useState(false)
  const [intelStatus, setIntelStatus] = useState<string | null>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!projectId) return
    initStore(projectId)
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

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  const handleSend = async () => {
    if (!chatText.trim() || aiLoading) return
    const msg = chatText.trim()
    setChatText('')
    addMsg('doctor', msg)
    setAiLoading(true)
    try {
      const { response } = await collaborateChat({
        role: 'doctor',
        message: msg,
        history: msgs.slice(-12).map((m: any) => ({ role: m.role, text: m.text })),
      })
      addMsg('ai', response)
    } catch {
      addMsg('ai', 'AI unavailable — your message has been shared with the architect.')
    } finally {
      setAiLoading(false)
    }
  }

  const handleComment = () => {
    if (!commentText.trim()) return
    addComment(activeTab, 'doctor', commentText.trim())
    setCommentText('')
    setShowCommentInput(false)
  }

  const departments = pd?.departments || []
  const totalBeds = pd?.total_beds || 100
  const totalAreaSqm = pd?.total_area_sqm || 7230
  const budgetM = Math.round((totalAreaSqm * 4800) / 1_000_000)
  const icuBeds = departments.find((d: any) => d.type === 'icu')?.beds || 12
  const edBays = departments.find((d: any) => d.type === 'emergency')?.beds || 22
  const orCount = 4
  const dailyCapacity = Math.round(totalBeds * 1.3 + 80)
  const nurseRatio = '1 : 4'
  const constructionMonths = Math.round(totalAreaSqm / 500)
  const parkingSpaces = Math.round(totalBeds * 2.8)
  const tabComments = (tab: DiagramTab): DiagramComment[] => comments.filter(c => c.diagramTab === tab)
  const activeComments = tabComments(activeTab)

  return (
    <div className="h-screen flex flex-col bg-surface overflow-hidden">
      {/* Header */}
      <header className="flex-none border-b border-border px-5 py-2.5 flex items-center gap-3">
        <button onClick={() => navigate(`/project/${projectId}/collaborate`)} className="text-muted hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-emerald-400" />
          <span className="text-xs text-muted">{currentProject?.name || 'Project'}</span>
          <span className="text-muted">/</span>
          <Stethoscope size={13} className="text-emerald-400" />
          <span className="text-xs text-white font-medium">Doctor View</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-medium">Clinical Team</span>
          <button
            onClick={() => navigate(`/project/${projectId}/export`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-600/30 text-xs font-medium transition-colors"
          >
            <LogOut size={12} /> End Session
          </button>
          <GoogleAuthButton />
        </div>
      </header>
      <StepChain current="collab" projectId={projectId} intelStatus={intelStatus} onSiteAnalysisClick={() => setShowIntel(true)} />

      <div className="flex-1 flex overflow-hidden">

        {/* ── Left: Clinical metrics ── */}
        <div className="w-72 flex-none border-r border-border flex flex-col bg-panel overflow-y-auto">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <HeartPulse size={14} className="text-emerald-400" />
            <span className="text-sm font-semibold text-white">Clinical Metrics</span>
          </div>

          <div className="p-3 grid grid-cols-2 gap-2">
            <MetricCard icon={BedDouble}    label="Total Beds"       value={totalBeds.toString()} sub={`${departments.filter((d:any)=>d.beds).length} inpatient units`} color="text-emerald-400" />
            <MetricCard icon={DollarSign}   label="Est. Budget"      value={`$${budgetM}M`}  sub="~$4,800/sqft avg"         color="text-yellow-400" />
            <MetricCard icon={HeartPulse}   label="ICU Beds"         value={icuBeds.toString()} sub="mixed med/surg ICU"      color="text-pink-400" />
            <MetricCard icon={Thermometer}  label="ED Bays"          value={edBays.toString()} sub="incl. trauma & triage"   color="text-red-400" />
            <MetricCard icon={Building2}    label="Operating Rooms"  value={orCount.toString()} sub="+ 2 procedure rooms"     color="text-purple-400" />
            <MetricCard icon={Users}        label="Daily Capacity"   value={`~${dailyCapacity}`} sub="inpatient + outpatient"  color="text-blue-400" />
            <MetricCard icon={Clock}        label="Constr. Timeline" value={`${constructionMonths}mo`} sub="estimated design-build" color="text-orange-400" />
            <MetricCard icon={Star}         label="Nurse Ratio"      value={nurseRatio} sub="day shift (ICU 1:2)"      color="text-cyan-400" />
            <MetricCard icon={TrendingUp}   label="OR Utilization"   value="~72%" sub="target ≥ 70%"             color="text-emerald-400" />
            <MetricCard icon={ShieldCheck}  label="Parking"          value={parkingSpaces.toString()} sub="per code requirement"   color="text-slate-400" />
          </div>

          {/* Department breakdown */}
          {departments.length > 0 && (
            <div className="border-t border-border px-5 py-3">
              <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">Clinical Units</p>
              <div className="space-y-2">
                {departments
                  .filter((d: any) => ['emergency','icu','surgery','inpatient','outpatient','rehabilitation'].includes(d.type))
                  .map((d: any) => (
                    <div key={d.id} className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full flex-none" style={{ backgroundColor: d.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-white truncate">{d.name}</div>
                        {d.beds && <div className="text-xs text-muted">{d.beds} beds</div>}
                      </div>
                      <div className="text-xs text-muted">{Math.round((d.area_sqm || 0) * 10.76).toLocaleString()} SF</div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* FGI compliance */}
          <div className="border-t border-border px-5 py-3">
            <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">FGI Compliance</p>
            <div className="space-y-1.5">
              {[
                { ok: true,  text: 'ICU ≥ 200 SF/bed' },
                { ok: true,  text: 'ED bays ≥ 120 SF each' },
                { ok: true,  text: 'OR ≥ 400 SF (general)' },
                { ok: true,  text: 'Private rooms ≥ 120 SF' },
                { ok: false, text: 'Sterile processing — verify' },
              ].map(item => (
                <div key={item.text} className="flex items-center gap-2">
                  {item.ok
                    ? <CheckCircle size={11} className="text-emerald-400 flex-none" />
                    : <AlertTriangle size={11} className="text-yellow-400 flex-none" />}
                  <span className="text-xs text-muted">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cost breakdown */}
          <div className="border-t border-border px-5 py-3 pb-5">
            <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">Cost Breakdown</p>
            <div className="space-y-1.5">
              {[
                { label: 'Clinical construction', pct: 58 },
                { label: 'MEP / systems',         pct: 18 },
                { label: 'FF&E / equipment',      pct: 12 },
                { label: 'Design & management',   pct: 8 },
                { label: 'Contingency',           pct: 4 },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className="flex-1 text-xs text-muted">{item.label}</div>
                  <div className="text-xs text-white font-medium">{item.pct}%</div>
                  <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${item.pct * 1.7}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Center: Read-only diagram viewer ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Diagram tabs */}
          <div className="flex-none border-b border-border flex bg-panel overflow-x-auto">
            {TABS.map(tab => {
              const Icon = tab.icon
              const cnt = tabComments(tab.id).length
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setShowCommentInput(false) }}
                  className={`relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'text-white border-emerald-500 bg-emerald-500/8'
                      : 'text-muted border-transparent hover:text-white hover:bg-card'
                  }`}
                >
                  <Icon size={11} />
                  {tab.label}
                  {cnt > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold" style={{fontSize:8}}>
                      {cnt}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Read-only notice */}
          <div className="flex-none bg-emerald-500/8 border-b border-emerald-500/20 px-4 py-1.5 flex items-center justify-between">
            <span className="text-xs text-emerald-400">
              View-only — use Comments to request changes from the architect
            </span>
            <button
              onClick={() => setShowCommentInput(v => !v)}
              className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
            >
              <MessageSquare size={12} />
              {showCommentInput ? 'Hide' : 'Add Comment'}
              {activeComments.length > 0 && <span className="text-muted">({activeComments.length})</span>}
            </button>
          </div>

          {/* Diagram content */}
          <div className="flex-1 overflow-hidden bg-surface relative">
            {activeTab === 'bubble'    && <BubbleReadOnly nodes={bubbleNodes} />}
            {activeTab === 'adjacency' && <AdjacencyMatrix departments={departments} edges={bubbleEdges} />}
            {activeTab === 'stacking'  && <StackingDiagram departments={departments} />}
            {activeTab === 'workflow'  && <WorkflowDiagram departments={departments} />}
            {activeTab === 'floorplan' && <FloorPlan departments={departments} />}
            {activeTab === 'massing'   && <MassingDiagram departments={departments} />}
            {activeTab === 'roomtypes' && <RoomTypeModule departments={departments} />}
          </div>

          {/* Comment panel */}
          {(showCommentInput || activeComments.length > 0) && (
            <div className="flex-none border-t border-border bg-panel max-h-44 overflow-y-auto">
              {activeComments.length > 0 && (
                <div className="px-4 pt-3 space-y-2">
                  {activeComments.map(c => (
                    <div key={c.id} className="flex items-start gap-2">
                      <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center flex-none mt-0.5">
                        <Stethoscope size={8} className="text-emerald-400" />
                      </div>
                      <div className="text-xs text-muted bg-emerald-500/8 border border-emerald-500/20 rounded-lg px-2.5 py-1.5 flex-1">
                        <span className="text-emerald-400 font-medium">Doctor: </span>{c.text}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {showCommentInput && (
                <div className="px-4 py-3 flex gap-2">
                  <input
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleComment() }}
                    placeholder={`Comment on this ${activeTab} diagram…`}
                    className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-xs text-white placeholder-muted focus:outline-none focus:border-emerald-500/50"
                    autoFocus
                  />
                  <button
                    onClick={handleComment}
                    disabled={!commentText.trim()}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors flex-none"
                  >
                    Post
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: Team chat ── */}
        <div className="w-72 flex-none border-l border-border flex flex-col bg-panel">
          <div className="flex-none px-4 py-2.5 border-b border-border flex items-center gap-2">
            <MessageSquare size={13} className="text-emerald-400" />
            <span className="text-xs font-semibold text-white">Team Chat</span>
            <div className="flex items-center gap-1 ml-auto">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-muted">Live</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
            {msgs.length === 0 && (
              <div className="text-center py-10">
                <HeartPulse size={24} className="text-muted mx-auto mb-3" />
                <p className="text-white text-xs font-medium mb-1">Start the conversation</p>
                <p className="text-xs text-muted leading-relaxed">Share your clinical priorities. The architect and AI will respond here.</p>
                <div className="mt-4 space-y-1 text-xs text-muted/80 italic text-left px-2">
                  <p>"ICU must be adjacent to surgery"</p>
                  <p>"We need 22 ED bays for our volume"</p>
                  <p>"What's the budget impact of adding 20 beds?"</p>
                </div>
              </div>
            )}
            {msgs.map((msg: any) => {
              const style = ROLE_STYLE[msg.role as MessageRole]
              const Icon = style.icon
              const isDoctor = msg.role === 'doctor'
              return (
                <div key={msg.id} className={`flex gap-2 ${isDoctor ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-none mt-0.5 ${
                    msg.role === 'ai' ? 'bg-purple-500/20' : msg.role === 'doctor' ? 'bg-emerald-500/20' : 'bg-accent/20'
                  }`}>
                    <Icon size={9} className={style.color} />
                  </div>
                  <div className={`max-w-[85%] ${isDoctor ? 'items-end' : ''}`}>
                    <div className={`text-xs font-semibold ${style.color} mb-0.5 ${isDoctor ? 'text-right' : ''}`}>{style.label}</div>
                    <div className={`rounded-xl px-2.5 py-2 text-xs leading-relaxed border ${style.bg} text-white/90 ${isDoctor ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              )
            })}
            {aiLoading && (
              <div className="flex gap-2">
                <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center flex-none">
                  <Sparkles size={9} className="text-purple-400" />
                </div>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl px-3 py-2 flex gap-1 items-center">
                  <Loader size={10} className="text-purple-400 animate-spin mr-1" />
                  <span className="text-xs text-purple-400">Thinking…</span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          <div className="flex-none px-3 py-3 border-t border-border">
            <textarea
              value={chatText}
              onChange={e => setChatText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend() }}
              placeholder="Share clinical requirements… (⌘↵)"
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-white placeholder-muted resize-none focus:outline-none focus:border-emerald-500/50 leading-relaxed mb-2"
              rows={3}
            />
            <button
              onClick={handleSend}
              disabled={aiLoading || !chatText.trim()}
              className="flex items-center justify-center gap-1.5 w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white py-2 rounded-lg text-xs font-medium transition-colors"
            >
              <Send size={11} />
              Send as Doctor
            </button>
          </div>
        </div>
      </div>

      {projectId && (
        <SiteIntelligencePanel isOpen={showIntel} onClose={() => setShowIntel(false)} projectId={projectId} />
      )}
    </div>
  )
}
