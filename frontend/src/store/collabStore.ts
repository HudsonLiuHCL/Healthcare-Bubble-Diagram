import { create } from 'zustand'
import { v4 as uuid } from 'uuid'

export type MessageRole = 'doctor' | 'architect' | 'ai'

export interface CollabMessage {
  id: string
  role: MessageRole
  text: string
  timestamp: number
}

export interface Department {
  id: string
  name: string
  area_sqm: number
  type: string
  color: string
  zone?: string
  beds?: number
  description?: string
}

export interface ProgramData {
  departments?: Department[]
  total_area_sqm?: number
  total_beds?: number
  summary?: string
}

export interface DiagramComment {
  id: string
  diagramTab: string
  role: MessageRole
  text: string
  timestamp: number
}

interface CollabState {
  projectId: string | null
  messages: CollabMessage[]
  comments: DiagramComment[]
  bubbleNodes: any[]
  bubbleEdges: any[]
  programData: ProgramData | null
  generating: boolean
}

interface CollabActions {
  init: (projectId: string) => void
  addMessage: (role: MessageRole, text: string) => void
  addComment: (diagramTab: string, role: MessageRole, text: string) => void
  setBubbleData: (nodes: any[], edges: any[], programData: ProgramData) => void
  setGenerating: (v: boolean) => void
  clearDiagrams: () => void
  hydrateMock: (nodes: any[], edges: any[], programData: ProgramData, mockMessages: CollabMessage[]) => void
}

const storageKey = (pid: string) => `healtharch_collab_${pid}`
let broadcastChannel: BroadcastChannel | null = null

const initialState: CollabState = {
  projectId: null,
  messages: [],
  comments: [],
  bubbleNodes: [],
  bubbleEdges: [],
  programData: null,
  generating: false,
}

function syncToStorage(projectId: string, state: CollabState) {
  const toStore = { ...state, generating: false }
  try { localStorage.setItem(storageKey(projectId), JSON.stringify(toStore)) } catch {}
  broadcastChannel?.postMessage({ type: 'sync', payload: toStore })
}

export const useCollabStore = create<CollabState & CollabActions>((set, get) => ({
  ...initialState,

  init(projectId) {
    broadcastChannel?.close()
    broadcastChannel = new BroadcastChannel(`healtharch_${projectId}`)
    broadcastChannel.onmessage = ({ data }) => {
      if (data?.type === 'sync') set({ ...data.payload, generating: false })
    }
    try {
      const raw = localStorage.getItem(storageKey(projectId))
      if (raw) {
        const parsed = JSON.parse(raw) as CollabState
        set({ ...parsed, projectId, generating: false })
        return
      }
    } catch {}
    set({ ...initialState, projectId })
  },

  addMessage(role, text) {
    const state = get()
    if (!state.projectId) return
    const msg: CollabMessage = { id: uuid(), role, text, timestamp: Date.now() }
    const messages = [...state.messages, msg]
    set({ messages })
    syncToStorage(state.projectId, { ...state, messages })
  },

  addComment(diagramTab, role, text) {
    const state = get()
    if (!state.projectId) return
    const comment: DiagramComment = { id: uuid(), diagramTab, role, text, timestamp: Date.now() }
    const comments = [...state.comments, comment]
    const collabMsg: CollabMessage = { id: uuid(), role, text: `[Comment on ${diagramTab}] ${text}`, timestamp: Date.now() }
    const messages = [...state.messages, collabMsg]
    set({ comments, messages })
    syncToStorage(state.projectId, { ...state, comments, messages })
  },

  setBubbleData(bubbleNodes, bubbleEdges, programData) {
    const state = get()
    if (!state.projectId) return
    const next = { ...state, bubbleNodes, bubbleEdges, programData }
    set({ bubbleNodes, bubbleEdges, programData })
    syncToStorage(state.projectId, next)
  },

  setGenerating(generating) { set({ generating }) },

  clearDiagrams() {
    const state = get()
    if (!state.projectId) return
    const next = { ...state, bubbleNodes: [], bubbleEdges: [], programData: null }
    set({ bubbleNodes: [], bubbleEdges: [], programData: null })
    syncToStorage(state.projectId, next)
  },

  hydrateMock(bubbleNodes, bubbleEdges, programData, mockMessages) {
    const state = get()
    if (!state.projectId) return
    const next = { ...state, bubbleNodes, bubbleEdges, programData, messages: mockMessages }
    set({ bubbleNodes, bubbleEdges, programData, messages: mockMessages })
    syncToStorage(state.projectId, next)
  },
}))
