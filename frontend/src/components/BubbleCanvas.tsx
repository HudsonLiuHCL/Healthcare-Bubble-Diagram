import { useCallback, memo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  BackgroundVariant,
  Handle,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

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

const BubbleNode = memo(({ data, selected }: { data: BubbleNodeData; selected: boolean }) => {
  const size = data.size || 100
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: data.color + '33',
        border: `${selected ? 3 : 2}px solid ${data.color}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
        boxShadow: selected ? `0 0 0 2px ${data.color}66` : 'none',
        cursor: 'grab',
        transition: 'all 0.15s',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <div
        style={{
          fontSize: size > 120 ? 11 : 9,
          fontWeight: 600,
          color: data.color,
          textAlign: 'center',
          lineHeight: 1.2,
          wordBreak: 'break-word',
          maxWidth: '90%',
        }}
      >
        {data.name}
      </div>
      <div
        style={{
          fontSize: size > 120 ? 9 : 8,
          color: data.color + 'aa',
          marginTop: 3,
          textAlign: 'center',
        }}
      >
        {data.area_sqm}m²
      </div>
    </div>
  )
})
BubbleNode.displayName = 'BubbleNode'

const nodeTypes = { bubbleNode: BubbleNode }

interface Props {
  initialNodes: Node[]
  initialEdges: Edge[]
  onNodesChange?: (nodes: Node[]) => void
  onEdgesChange?: (edges: Edge[]) => void
}

export default function BubbleCanvas({ initialNodes, initialEdges, onNodesChange, onEdgesChange }: Props) {
  const [nodes, setNodes, handleNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, handleEdgesChange] = useEdgesState(initialEdges)

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdges = addEdge({ ...params, type: 'smoothstep', style: { stroke: '#4f6ef7', strokeWidth: 2 } }, edges)
      setEdges(newEdges)
      onEdgesChange?.(newEdges)
    },
    [edges]
  )

  const handleNodes = useCallback(
    (changes: Parameters<typeof handleNodesChange>[0]) => {
      handleNodesChange(changes)
      // Debounce-free: call on every change — parent can debounce
      onNodesChange?.(nodes)
    },
    [nodes, handleNodesChange]
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={handleNodes}
      onEdgesChange={handleEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#2d3148" />
      <Controls position="bottom-right" />
      <MiniMap
        position="bottom-left"
        nodeColor={(n) => (n.data as BubbleNodeData).color || '#4f6ef7'}
        maskColor="rgba(15, 17, 23, 0.8)"
      />
    </ReactFlow>
  )
}
