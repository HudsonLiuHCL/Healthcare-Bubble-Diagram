import { create } from 'zustand'

interface Project {
  id: string
  name: string
  status: string
  starting_mode: string | null
  created_at: string
  updated_at: string
}

interface ProjectStore {
  projects: Project[]
  currentProject: Project | null
  setProjects: (p: Project[]) => void
  setCurrentProject: (p: Project | null) => void
  updateCurrentProject: (updates: Partial<Project>) => void
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: [],
  currentProject: null,
  setProjects: (projects) => set({ projects }),
  setCurrentProject: (currentProject) => set({ currentProject }),
  updateCurrentProject: (updates) =>
    set((s) => ({
      currentProject: s.currentProject ? { ...s.currentProject, ...updates } : null,
    })),
}))
