import { useState } from 'react'
import { Send, Sparkles } from 'lucide-react'

const STARTERS = [
  '100-bed community hospital with emergency department, surgery, ICU, and outpatient clinics',
  'Ambulatory care center with primary care, specialty clinics, radiology, and pharmacy',
  'Children\'s hospital with pediatric emergency, NICU, inpatient, and family support areas',
  'Cancer treatment center with radiation oncology, chemotherapy, surgery, and support services',
]

interface Props {
  onGenerate: (text: string) => void
  loading: boolean
}

export default function RequirementsChat({ onGenerate, loading }: Props) {
  const [text, setText] = useState('')

  const handleSubmit = () => {
    if (!text.trim() || loading) return
    onGenerate(text.trim())
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={15} className="text-purple-400" />
          <span className="text-sm font-medium text-white">Program Requirements</span>
        </div>
        <p className="text-xs text-muted">Describe your facility. The AI will generate an interactive bubble diagram.</p>
      </div>

      {/* Starters */}
      <div className="px-5 py-4 border-b border-border">
        <p className="text-xs text-muted mb-2">Quick start examples:</p>
        <div className="flex flex-col gap-2">
          {STARTERS.map(s => (
            <button
              key={s}
              onClick={() => setText(s)}
              className="text-left text-xs text-muted hover:text-white bg-surface hover:bg-border border border-border rounded-lg px-3 py-2 transition-colors leading-relaxed"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="flex-1 px-5 py-4 flex flex-col gap-3">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Describe your facility requirements, bed count, key departments, special workflows, patient volume, etc…"
          className="flex-1 w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-white placeholder-muted resize-none focus:outline-none focus:border-accent leading-relaxed"
          rows={8}
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !text.trim()}
          className="flex items-center justify-center gap-2 w-full bg-accent hover:bg-accent-hover disabled:opacity-40 text-white py-3 rounded-xl text-sm font-medium transition-colors"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating bubble diagram…
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Generate Bubble Diagram
            </>
          )}
        </button>
      </div>
    </div>
  )
}
