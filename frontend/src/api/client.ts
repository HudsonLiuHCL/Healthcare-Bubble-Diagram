import axios from 'axios'

export const api = axios.create({ baseURL: '/api' })

// ─── Projects ───────────────────────────────────────────────────────────────
export const getProjects = () => api.get('/projects/').then(r => r.data)
export const createProject = (name: string) => api.post('/projects/', { name }).then(r => r.data)
export const getProject = (id: string) => api.get(`/projects/${id}`).then(r => r.data)
export const updateProject = (id: string, data: Record<string, unknown>) =>
  api.patch(`/projects/${id}`, data).then(r => r.data)
export const deleteProject = (id: string) => api.delete(`/projects/${id}`).then(r => r.data)
export const exportProject = (id: string) => api.get(`/projects/${id}/export`).then(r => r.data)

// Publish a project to the Revit handoff store. Requires a Google ID token
// (Bearer) — the backend verifies it and stamps the row with the user's identity.
export const publishProject = (id: string, idToken: string) =>
  api.post(`/projects/${id}/publish`, null, {
    headers: { Authorization: `Bearer ${idToken}` },
  }).then(r => r.data)

// ─── Sites ───────────────────────────────────────────────────────────────────
export const confirmSite = (projectId: string, data: {
  address?: string
  lat?: number
  lng?: number
  parcel_geojson?: object
  lot_area_sqm?: number
}) => api.post(`/projects/${projectId}/site/confirm`, data).then(r => r.data)

export const getSite = (projectId: string) =>
  api.get(`/projects/${projectId}/site/`).then(r => r.data)

// ─── Intelligence ────────────────────────────────────────────────────────────
export const getIntelligence = (projectId: string) =>
  api.get(`/projects/${projectId}/intelligence/`).then(r => r.data)

// ─── Bubble Diagrams ─────────────────────────────────────────────────────────
export const getBubbles = (projectId: string) =>
  api.get(`/projects/${projectId}/bubble/`).then(r => r.data)

export const generateBubble = (projectId: string, requirements_text: string) =>
  api.post(`/projects/${projectId}/bubble/generate`, { requirements_text }).then(r => r.data)

export const updateBubble = (projectId: string, bubbleId: string, data: {
  nodes?: object[]
  edges?: object[]
  status?: string
}) => api.patch(`/projects/${projectId}/bubble/${bubbleId}`, data).then(r => r.data)

export const refineBubble = (projectId: string, bubbleId: string, data: {
  refinement_text: string
  current_nodes: object[]
  current_program: object
}) => api.post(`/projects/${projectId}/bubble/${bubbleId}/refine`, data).then(r => r.data)

// ─── Collaborate ─────────────────────────────────────────────────────────────
export const collaborateChat = (data: {
  role: string
  message: string
  history: { role: string; text: string }[]
}) => api.post('/collaborate/chat', data).then(r => r.data as { response: string })

// ─── Files ───────────────────────────────────────────────────────────────────
export const uploadFile = (projectId: string, file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post(`/projects/${projectId}/files/`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const getFiles = (projectId: string) =>
  api.get(`/projects/${projectId}/files/`).then(r => r.data)
