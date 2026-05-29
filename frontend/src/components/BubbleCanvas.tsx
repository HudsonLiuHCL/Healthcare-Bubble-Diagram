import { useCallback, memo, useState, useRef } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls,
  addEdge, useNodesState, useEdgesState, useReactFlow,
  type Node, type Edge, type Connection, BackgroundVariant,
  Handle, Position, type NodeMouseHandler,
  ConnectionLineType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  MousePointer2, CircleDot, Link2, Trash2,
  CirclePlus, Minus, Plus,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tool = 'select' | 'add' | 'resize' | 'connect' | 'delete'
type EdgeKind = 'required' | 'desired' | 'optional'

interface BubbleNodeData {
  name: string
  area_sqm: number
  type: string
  color: string
  size: number
  description?: string
  zone?: string
  beds?: number
  [key: string]: unknown
}

interface Props {
  initialNodes: Node[]
  initialEdges: Edge[]
  onNodesChange?: (nodes: Node[]) => void
  onEdgesChange?: (edges: Edge[]) => void
}

// ─── Node ────────────────────────────────────────────────────────────────────

const BubbleNode = memo(({
  data, selected,
}: { data: BubbleNodeData; selected: boolean }) => {
  const size = Math.max(72, data.size || 100)
  const c = data.color || '#5e9898'

  // Text scales with circle but caps so it doesn't overflow
  const nameFontSize = Math.max(9, Math.min(13, size * 0.13))
  const areaFontSize = Math.max(8, nameFontSize - 2)

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: c + '28',           // ~16 % tint — vivid but readable
        border: `${selected ? 3 : 2}px solid ${c}`,
        boxShadow: selected
          ? `0 0 0 4px ${c}30, 0 6px 28px ${c}50`
          : `0 2px 14px rgba(0,0,0,0.50)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        cursor: 'grab',
        userSelect: 'none',
        transition: 'box-shadow 0.15s, border-width 0.1s',
        position: 'relative',
      }}
    >
      <Handle type="source" position={Position.Top}
        style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', opacity: 0, width: 1, height: 1 }} />
      <Handle type="target" position={Position.Top} id="t"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', opacity: 0, width: 1, height: 1 }} />

      <span style={{
        fontSize: nameFontSize,
        fontWeight: 700,
        color: c,
        textAlign: 'center',
        lineHeight: 1.2,
        letterSpacing: '0.04em',
        maxWidth: '80%',
        wordBreak: 'break-word',
      }}>
        {data.name.toUpperCase()}
      </span>

      {data.area_sqm > 0 && (
        <span style={{
          fontSize: areaFontSize,
          color: c + '99',
          letterSpacing: '0.02em',
        }}>
          {data.area_sqm.toLocaleString()} m²
        </span>
      )}
    </div>
  )
})
BubbleNode.displayName = 'BubbleNode'

const nodeTypes = { bubbleNode: BubbleNode }

// ─── Edge style per kind ──────────────────────────────────────────────────────

function edgeStyle(kind: EdgeKind) {
  if (kind === 'required')
    return { stroke: '#5e9898', strokeWidth: 2 }
  if (kind === 'desired')
    return { stroke: '#7ab8b8', strokeWidth: 1.5, strokeDasharray: '7 4' }
  return { stroke: '#8ca8a8', strokeWidth: 1, strokeDasharray: '3 5' }
}

function edgeDefaults(kind: EdgeKind, params: Connection): Edge {
  return {
    ...params,
    id: `e-${params.source}-${params.target}-${Date.now()}`,
    source: params.source,
    target: params.target,
    type: 'straight',
    style: edgeStyle(kind),
    data: { kind },
  }
}

// ─── Toolbar button ────────────────────────────────────────────────────────────

const ToolBtn = ({
  icon: Icon, label, active, onClick, danger,
}: {
  icon: React.ElementType
  label: string
  active: boolean
  onClick: () => void
  danger?: boolean
}) => (
  <button
    title={label}
    onClick={onClick}
    style={{
      width: 36,
      height: 36,
      borderRadius: 8,
      border: `1.5px solid ${active ? (danger ? '#f87171' : '#5e9898') : 'rgba(255,255,255,0.1)'}`,
      background: active ? (danger ? 'rgba(248,113,113,0.15)' : 'rgba(94,152,152,0.2)') : 'rgba(255,255,255,0.04)',
      color: active ? (danger ? '#f87171' : '#7dd8d8') : 'rgba(255,255,255,0.45)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'all 0.15s',
    }}
  >
    <Icon size={16} />
  </button>
)

// ─── Legend row ────────────────────────────────────────────────────────────────

const LegendRow = ({ kind, label }: { kind: EdgeKind; label: string }) => {
  const s = edgeStyle(kind)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <svg width={36} height={10}>
        <line
          x1={2} y1={5} x2={34} y2={5}
          stroke={s.stroke}
          strokeWidth={s.strokeWidth}
          strokeDasharray={(s as any).strokeDasharray}
        />
      </svg>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  )
}

// ─── Inner canvas (needs ReactFlowProvider context) ────────────────────────────

function BubbleCanvasInner({ initialNodes, initialEdges, onNodesChange, onEdgesChange }: Props) {
  const { screenToFlowPosition } = useReactFlow()

  const [nodes, setNodes, handleNodesChange] = useNodesState(initialNodes)

  // Force all edges (including those loaded from the DB) to straight type
  const straightEdges: Edge[] = initialEdges.map(e => ({ ...e, type: 'straight' as const }))
  const [edges, setEdges, handleEdgesChange] = useEdgesState(straightEdges)

  const [tool, setTool] = useState<Tool>('select')
  const [edgeKind, setEdgeKind] = useState<EdgeKind>('desired')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // "Add room" inline input state
  const [addPos, setAddPos] = useState<{ x: number; y: number } | null>(null)
  const [addName, setAddName] = useState('')
  const addInputRef = useRef<HTMLInputElement>(null)

  // ── Connections ──────────────────────────────────────────────────────────────
  const onConnect = useCallback((params: Connection) => {
    const newEdges = addEdge(edgeDefaults(edgeKind, params), edges)
    setEdges(newEdges)
    onEdgesChange?.(newEdges)
  }, [edges, edgeKind, onEdgesChange])

  // ── Node clicks ──────────────────────────────────────────────────────────────
  const onNodeClick: NodeMouseHandler = useCallback((_e, node) => {
    if (tool === 'delete') {
      const nextNodes = nodes.filter(n => n.id !== node.id)
      const nextEdges = edges.filter(e => e.source !== node.id && e.target !== node.id)
      setNodes(nextNodes)
      setEdges(nextEdges)
      onNodesChange?.(nextNodes)
      onEdgesChange?.(nextEdges)
      return
    }
    setSelectedId(node.id)
  }, [tool, nodes, edges, onNodesChange, onEdgesChange])

  // ── Edge clicks ───────────────────────────────────────────────────────────────
  const onEdgeClick = useCallback((_e: React.MouseEvent, edge: Edge) => {
    if (tool === 'delete') {
      const nextEdges = edges.filter(e => e.id !== edge.id)
      setEdges(nextEdges)
      onEdgesChange?.(nextEdges)
    }
  }, [tool, edges, onEdgesChange])

  // ── Pane click → add room ─────────────────────────────────────────────────────
  const onPaneClick = useCallback((e: React.MouseEvent) => {
    setSelectedId(null)
    if (tool !== 'add') return
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    setAddPos(pos)
    setAddName('')
    setTimeout(() => addInputRef.current?.focus(), 50)
  }, [tool, screenToFlowPosition])

  const confirmAdd = useCallback(() => {
    if (!addPos) return
    const name = addName.trim()
    if (name) {
      const newNode: Node = {
        id: `manual-${Date.now()}`,
        type: 'bubbleNode',
        position: { x: addPos.x - 50, y: addPos.y - 50 },
        data: { name, area_sqm: 0, type: 'general', color: '#5e9898', size: 100 },
      }
      const nextNodes = [...nodes, newNode]
      setNodes(nextNodes)
      onNodesChange?.(nextNodes)
    }
    setAddPos(null)
    setAddName('')
  }, [addPos, addName, nodes, onNodesChange])

  // ── Resize selected node ──────────────────────────────────────────────────────
  // Each +/− click changes area_sqm by 100 m² and derives size using the same
  // formula as sampleDiagrams.ts: sz = clamp(80, 200, round(sqrt(area) * 3.8))
  const resizeSelected = useCallback((areaDelta: number) => {
    if (!selectedId) return
    const nextNodes = nodes.map(n => {
      if (n.id !== selectedId) return n
      const curArea = (n.data as BubbleNodeData).area_sqm || 100
      const newArea = Math.max(50, curArea + areaDelta)
      const newSize = Math.max(80, Math.min(200, Math.round(Math.sqrt(newArea) * 3.8)))
      return { ...n, data: { ...n.data, area_sqm: newArea, size: newSize } }
    })
    setNodes(nextNodes)
    onNodesChange?.(nextNodes)
  }, [selectedId, nodes, onNodesChange])

  // ── Node/edge change callbacks ────────────────────────────────────────────────
  const handleNodeChange = useCallback((changes: Parameters<typeof handleNodesChange>[0]) => {
    handleNodesChange(changes)
    // propagate after react updates nodes
    setTimeout(() => onNodesChange?.(nodes), 0)
  }, [handleNodesChange, nodes, onNodesChange])

  const handleEdgeChange = useCallback((changes: Parameters<typeof handleEdgesChange>[0]) => {
    handleEdgesChange(changes)
    setTimeout(() => onEdgesChange?.(edges), 0)
  }, [handleEdgesChange, edges, onEdgesChange])

  // ── Cursor style ──────────────────────────────────────────────────────────────
  const cursor =
    tool === 'add' ? 'crosshair' :
    tool === 'delete' ? 'not-allowed' :
    tool === 'connect' ? 'cell' :
    'default'

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>

      {/* ── Left toolbar ── */}
      <div style={{
        position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
        zIndex: 10, display: 'flex', flexDirection: 'column', gap: 6,
        background: 'rgba(15,18,26,0.88)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12, padding: '10px 8px', backdropFilter: 'blur(8px)',
      }}>
        <ToolBtn icon={MousePointer2} label="Select (V)" active={tool === 'select'} onClick={() => setTool('select')} />
        <ToolBtn icon={CirclePlus}   label="Add Room (A)"  active={tool === 'add'}    onClick={() => setTool('add')} />
        <ToolBtn icon={CircleDot}    label="Resize (R)"    active={tool === 'resize'} onClick={() => setTool('resize')} />
        <ToolBtn icon={Link2}        label="Connect (C)"   active={tool === 'connect'}onClick={() => setTool('connect')} />
        <div style={{ width: 20, height: 1, background: 'rgba(255,255,255,0.1)', margin: '2px auto' }} />
        <ToolBtn icon={Trash2}       label="Delete (X)"    active={tool === 'delete'} onClick={() => setTool('delete')} danger />
      </div>

      {/* ── Resize controls (shown when resize tool + node selected) ── */}
      {tool === 'resize' && selectedId && (() => {
        const selNode = nodes.find(n => n.id === selectedId)
        const curArea = (selNode?.data as BubbleNodeData | undefined)?.area_sqm ?? 0
        return (
          <div style={{
            position: 'absolute', left: 60, top: '50%', transform: 'translateY(-50%)',
            zIndex: 10, background: 'rgba(15,18,26,0.92)', border: '1px solid rgba(94,152,152,0.3)',
            borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6,
            backdropFilter: 'blur(8px)', minWidth: 80, alignItems: 'center',
          }}>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Area</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#7dd8d8', letterSpacing: '0.02em' }}>
              {curArea} m²
            </span>
            <button onClick={() => resizeSelected(100)} style={resizeBtnStyle} title="+100 m²">
              <Plus size={14} />
            </button>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>100 m²</span>
            <button onClick={() => resizeSelected(-100)} style={resizeBtnStyle} title="−100 m²">
              <Minus size={14} />
            </button>
          </div>
        )
      })()}

      {/* ── Edge-kind selector (shown when connect tool active) ── */}
      {tool === 'connect' && (
        <div style={{
          position: 'absolute', left: 60, top: '50%', transform: 'translateY(-50%)',
          zIndex: 10, background: 'rgba(15,18,26,0.92)', border: '1px solid rgba(94,152,152,0.3)',
          borderRadius: 10, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5,
          backdropFilter: 'blur(8px)',
        }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Line type</span>
          {(['required', 'desired', 'optional'] as EdgeKind[]).map(k => (
            <button
              key={k}
              onClick={() => setEdgeKind(k)}
              style={{
                ...edgeKindBtnBase,
                border: `1.5px solid ${edgeKind === k ? '#5e9898' : 'rgba(255,255,255,0.1)'}`,
                background: edgeKind === k ? 'rgba(94,152,152,0.18)' : 'transparent',
                color: edgeKind === k ? '#7dd8d8' : 'rgba(255,255,255,0.45)',
              }}
            >
              <svg width={26} height={8} style={{ flexShrink: 0 }}>
                <line x1={1} y1={4} x2={25} y2={4}
                  stroke={edgeKind === k ? '#7dd8d8' : '#6b8a8a'}
                  strokeWidth={k === 'required' ? 2 : 1.5}
                  strokeDasharray={k === 'desired' ? '6 3' : k === 'optional' ? '2 4' : undefined}
                />
              </svg>
              <span style={{ fontSize: 10 }}>{k[0].toUpperCase() + k.slice(1)}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Legend (bottom-left) ── */}
      <div style={{
        position: 'absolute', bottom: 52, left: 12, zIndex: 10,
        background: 'rgba(15,18,26,0.82)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 8, padding: '8px 10px', backdropFilter: 'blur(6px)',
      }}>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Adjacency</span>
        <LegendRow kind="required" label="Required" />
        <LegendRow kind="desired"  label="Desired" />
        <LegendRow kind="optional" label="Optional" />
      </div>

      {/* ── "Add Room" inline input ── */}
      {addPos && (
        <div style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
          zIndex: 20, background: 'rgba(15,18,26,0.96)', border: '1px solid rgba(94,152,152,0.4)',
          borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8,
          minWidth: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)',
        }}>
          <span style={{ fontSize: 11, color: '#7dd8d8', fontWeight: 600 }}>New Room</span>
          <input
            ref={addInputRef}
            value={addName}
            onChange={e => setAddName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') setAddPos(null) }}
            placeholder="Room name…"
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(94,152,152,0.3)',
              borderRadius: 6, color: '#fff', fontSize: 12, padding: '6px 10px', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={confirmAdd} style={confirmBtnStyle}>Add</button>
            <button onClick={() => setAddPos(null)} style={cancelBtnStyle}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── ReactFlow canvas ── */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodeChange}
        onEdgesChange={handleEdgeChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.22 }}
        minZoom={0.15}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={tool !== 'delete'}
        nodesConnectable={tool === 'connect' || tool === 'select'}
        style={{ cursor }}
        connectionLineType={ConnectionLineType.Straight}
        defaultEdgeOptions={{
          type: 'straight',
          style: { stroke: '#7ab8b8', strokeWidth: 1.5, strokeDasharray: '7 4' },
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="#1e2535" />
        <Controls position="bottom-right" showInteractive={false} />
      </ReactFlow>
    </div>
  )
}

// ─── Button styles ─────────────────────────────────────────────────────────────

const resizeBtnStyle: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 6,
  border: '1px solid rgba(94,152,152,0.35)',
  background: 'rgba(94,152,152,0.12)',
  color: '#7dd8d8', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const edgeKindBtnBase: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
  transition: 'all 0.12s',
}
const confirmBtnStyle: React.CSSProperties = {
  flex: 1, padding: '5px 0', borderRadius: 6,
  background: 'rgba(94,152,152,0.25)', border: '1px solid rgba(94,152,152,0.4)',
  color: '#7dd8d8', fontSize: 12, cursor: 'pointer', fontWeight: 600,
}
const cancelBtnStyle: React.CSSProperties = {
  flex: 1, padding: '5px 0', borderRadius: 6,
  background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
  color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer',
}

// ─── Public export (wrapped in provider) ─────────────────────────────────────

export default function BubbleCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <BubbleCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
