import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FolderOpen, Trash2, Download, ChevronRight, Activity } from 'lucide-react'
import { createProject, getProjects, deleteProject, exportProject } from '../api/client'
import { useProjectStore } from '../store/projectStore'

const STATUS_LABEL: Record<string, string> = {
  site_selection: 'Site Selection',
  starting_path: 'Choose Path',
  bubble_diagram: 'Bubble Diagram',
  upload_design: 'Design Upload',
  design_editor: 'Design Ready',
}

const STATUS_COLOR: Record<string, string> = {
  site_selection: 'bg-blue-500/20 text-blue-400',
  starting_path: 'bg-yellow-500/20 text-yellow-400',
  bubble_diagram: 'bg-purple-500/20 text-purple-400',
  upload_design: 'bg-green-500/20 text-green-400',
  design_editor: 'bg-emerald-500/20 text-emerald-400',
}

const STATUS_ROUTE: Record<string, string> = {
  site_selection: 'site',
  starting_path: 'start',
  bubble_diagram: 'bubble',
  upload_design: 'upload',
  design_editor: 'bubble',
}

export default function Home() {
  const navigate = useNavigate()
  const { projects, setProjects, setCurrentProject } = useProjectStore()
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    getProjects().then(setProjects).catch(console.error)
  }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const project = await createProject(newName.trim())
      setProjects([project, ...projects])
      setCurrentProject(project)
      navigate(`/project/${project.id}/site`)
    } finally {
      setCreating(false)
      setNewName('')
      setShowCreate(false)
    }
  }

  const handleOpen = (project: (typeof projects)[0]) => {
    setCurrentProject(project)
    const route = STATUS_ROUTE[project.status] || 'site'
    navigate(`/project/${project.id}/${route}`)
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('Delete this project?')) return
    await deleteProject(id)
    setProjects(projects.filter(p => p.id !== id))
  }

  const handleExport = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation()
    const data = await exportProject(id)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name.replace(/\s+/g, '_')}_healtharch.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="border-b border-border px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <Activity size={16} className="text-white" />
          </div>
          <span className="text-lg font-semibold text-white">HealthArch</span>
          <span className="text-xs text-muted px-2 py-0.5 bg-border rounded">BETA</span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          New Project
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-12">
        {/* Hero */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-3">
            Healthcare Facility Planner
          </h1>
          <p className="text-muted text-lg max-w-xl">
            AI-powered site analysis, bubble diagram generation, and program planning —
            built for healthcare architects.
          </p>
        </div>

        {/* Create modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-panel border border-border rounded-2xl p-8 w-full max-w-md shadow-2xl">
              <h2 className="text-xl font-semibold text-white mb-2">New Project</h2>
              <p className="text-muted text-sm mb-6">Give your healthcare facility project a name to get started.</p>
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="e.g. Riverside Medical Center"
                className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-white placeholder-muted text-sm focus:outline-none focus:border-accent mb-4"
              />
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setShowCreate(false); setNewName('') }}
                  className="px-4 py-2 text-sm text-muted hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !newName.trim()}
                  className="px-6 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {creating ? 'Creating…' : 'Create Project'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Projects */}
        {projects.length === 0 ? (
          <div className="border border-dashed border-border rounded-2xl p-16 text-center">
            <FolderOpen size={48} className="mx-auto text-muted mb-4 opacity-40" />
            <p className="text-muted mb-6">No projects yet. Create your first healthcare facility project.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-6 py-3 rounded-lg text-sm font-medium transition-colors mx-auto"
            >
              <Plus size={16} />
              Create Project
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            <p className="text-muted text-sm">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
            {projects.map(project => (
              <div
                key={project.id}
                onClick={() => handleOpen(project)}
                className="bg-panel border border-border hover:border-accent/40 rounded-xl p-6 flex items-center justify-between cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center text-accent">
                    <Activity size={18} />
                  </div>
                  <div>
                    <div className="text-white font-medium group-hover:text-accent transition-colors">
                      {project.name}
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      {new Date(project.created_at).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[project.status] || 'bg-gray-500/20 text-gray-400'}`}>
                    {STATUS_LABEL[project.status] || project.status}
                  </span>
                  <button
                    onClick={e => handleExport(e, project.id, project.name)}
                    className="p-2 text-muted hover:text-white rounded-lg hover:bg-border transition-colors"
                    title="Export JSON for Revit"
                  >
                    <Download size={16} />
                  </button>
                  <button
                    onClick={e => handleDelete(e, project.id)}
                    className="p-2 text-muted hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                  <ChevronRight size={16} className="text-muted group-hover:text-white transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
