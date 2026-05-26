import { useState, useRef, useEffect } from 'react'
import { Sparkles, Zap, Send, RotateCcw, MessageSquare, Lock } from 'lucide-react'
import { SAMPLE_DIAGRAMS, type SampleDiagram } from '../data/sampleDiagrams'

export interface ChatMessage {
  role: 'user' | 'ai'
  text: string
}

interface Props {
  onGenerate: (text: string) => void
  onLoadSample: (diagram: SampleDiagram) => void
  loading: boolean
  // Chat / refine mode
  chatHistory?: ChatMessage[]
  onRefine?: (text: string) => void
  refineLoading?: boolean
  onStartOver?: () => void
  isSample?: boolean
}

const ZONE_PREVIEW_COLORS: Record<string, string[]> = {
  'community-hospital': ['#ef4444', '#8b5cf6', '#ec4899', '#3b82f6', '#a78bfa', '#fbbf24', '#84cc16', '#10b981', '#f97316', '#14b8a6'],
  'ambulatory-surgery': ['#f97316', '#8b5cf6', '#7c3aed', '#6d28d9', '#a78bfa', '#fbbf24', '#84cc16', '#10b981', '#14b8a6', '#6b7280'],
  'childrens-hospital': ['#ef4444', '#ec4899', '#f472b6', '#8b5cf6', '#3b82f6', '#2563eb', '#a78bfa', '#fbbf24', '#84cc16', '#10b981'],
  'cancer-center': ['#f97316', '#a78bfa', '#fbbf24', '#14b8a6', '#10b981', '#7c3aed', '#8b5cf6', '#3b82f6', '#84cc16', '#6b7280'],
}

// ── Chat mode ─────────────────────────────────────────────────────────────────

function ChatView({
  chatHistory, onRefine, refineLoading, onStartOver, isSample,
}: {
  chatHistory: ChatMessage[]
  onRefine?: (text: string) => void
  refineLoading?: boolean
  onStartOver?: () => void
  isSample?: boolean
}) {
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  const handleSend = () => {
    if (!text.trim() || refineLoading || isSample) return
    onRefine?.(text.trim())
    setText('')
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend()
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex-none flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-accent" />
          <span className="text-sm font-medium text-white">Diagram Chat</span>
        </div>
        <button
          onClick={onStartOver}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
          title="Start a new diagram"
        >
          <RotateCcw size={11} />
          New diagram
        </button>
      </div>

      {/* Message history */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {chatHistory.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'ai' && (
              <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-none mt-0.5">
                <Sparkles size={10} className="text-accent" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-accent/20 border border-accent/30 text-white'
                  : 'bg-panel border border-border text-slate-300'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-none px-4 py-3 border-t border-border">
        {isSample ? (
          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2.5">
            <Lock size={12} className="text-yellow-400 flex-none" />
            <p className="text-xs text-yellow-300 leading-relaxed">
              Save to database first to enable AI refinement
            </p>
          </div>
        ) : (
          <>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Describe changes… (⌘↵ to send)"
              className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-xs text-white placeholder-muted resize-none focus:outline-none focus:border-accent leading-relaxed mb-2"
              rows={3}
            />
            <button
              onClick={handleSend}
              disabled={refineLoading || !text.trim()}
              className="flex items-center justify-center gap-2 w-full bg-accent hover:bg-accent-hover disabled:opacity-40 text-white py-2.5 rounded-xl text-xs font-medium transition-colors"
            >
              {refineLoading ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Refining…
                </>
              ) : (
                <>
                  <Send size={12} />
                  Refine with AI
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Generate mode (original UI) ───────────────────────────────────────────────

function GenerateView({
  onGenerate, onLoadSample, loading,
}: {
  onGenerate: (text: string) => void
  onLoadSample: (diagram: SampleDiagram) => void
  loading: boolean
}) {
  const [text, setText] = useState('')
  const [active, setActive] = useState<string | null>(null)

  const handleSample = (diagram: SampleDiagram) => {
    setActive(diagram.id)
    onLoadSample(diagram)
  }

  const handleSubmit = () => {
    if (!text.trim() || loading) return
    setActive(null)
    onGenerate(text.trim())
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex-none">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={15} className="text-purple-400" />
          <span className="text-sm font-medium text-white">Program Requirements</span>
        </div>
        <p className="text-xs text-muted">Load a sample or describe your facility to generate a diagram.</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Sample diagrams */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={12} className="text-yellow-400" />
            <span className="text-xs font-medium text-yellow-400 uppercase tracking-wider">Sample Diagrams</span>
          </div>
          <div className="space-y-2">
            {SAMPLE_DIAGRAMS.map(diagram => {
              const isActive = active === diagram.id
              const colors = ZONE_PREVIEW_COLORS[diagram.id] || []
              return (
                <button
                  key={diagram.id}
                  onClick={() => handleSample(diagram)}
                  className={`w-full text-left rounded-xl border transition-all p-3.5 ${
                    isActive
                      ? 'border-accent bg-accent/15'
                      : 'border-border bg-panel hover:border-accent/40 hover:bg-card'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className={`text-xs font-semibold leading-tight ${isActive ? 'text-accent' : 'text-white'}`}>
                      {diagram.title}
                    </span>
                    {isActive && (
                      <span className="text-xs text-accent border border-accent/30 bg-accent/10 px-1.5 py-0.5 rounded flex-none">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted leading-relaxed mb-2">{diagram.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1 flex-wrap">
                      {diagram.tags.map(t => (
                        <span key={t} className="text-xs px-1.5 py-0.5 bg-surface border border-border/60 rounded text-muted">{t}</span>
                      ))}
                    </div>
                    <div className="flex gap-0.5 ml-2">
                      {colors.slice(0, 6).map((c, i) => (
                        <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted">or generate with AI</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* AI input */}
        <div className="px-4 pb-4 flex flex-col gap-3">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Describe your facility requirements, bed count, key departments, workflows…"
            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-white placeholder-muted resize-none focus:outline-none focus:border-accent leading-relaxed"
            rows={5}
          />
          <button
            onClick={handleSubmit}
            disabled={loading || !text.trim()}
            className="flex items-center justify-center gap-2 w-full bg-accent hover:bg-accent-hover disabled:opacity-40 text-white py-3 rounded-xl text-sm font-medium transition-colors"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles size={15} />
                Generate with AI
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function RequirementsChat({
  onGenerate, onLoadSample, loading,
  chatHistory, onRefine, refineLoading, onStartOver, isSample,
}: Props) {
  const inChatMode = chatHistory && chatHistory.length > 0

  if (inChatMode) {
    return (
      <ChatView
        chatHistory={chatHistory}
        onRefine={onRefine}
        refineLoading={refineLoading}
        onStartOver={onStartOver}
        isSample={isSample}
      />
    )
  }

  return (
    <GenerateView
      onGenerate={onGenerate}
      onLoadSample={onLoadSample}
      loading={loading}
    />
  )
}
