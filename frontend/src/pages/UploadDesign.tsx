import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Activity, ArrowLeft, Download, CheckCircle, FileText, Layers } from 'lucide-react'
import { getProject, getFiles, exportProject } from '../api/client'
import { useProjectStore } from '../store/projectStore'
import FileUpload, { type UploadedFile } from '../components/FileUpload'

type UploadedFileWithDate = UploadedFile & { created_at: string }

const TYPE_ICON: Record<string, string> = {
  dxf: '📐', pdf: '📄', image: '🖼', spreadsheet: '📊', text: '📝', document: '📋',
}

export default function UploadDesign() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { currentProject, setCurrentProject } = useProjectStore()
  const [files, setFiles] = useState<UploadedFileWithDate[]>([])

  useEffect(() => {
    if (!projectId) return
    if (!currentProject) getProject(projectId).then(setCurrentProject).catch(console.error)
    getFiles(projectId).then(setFiles).catch(console.error)
  }, [projectId])

  const handleFilesUploaded = (newFiles: UploadedFile[]) => {
    setFiles(prev => [...(newFiles as UploadedFileWithDate[]), ...prev])
  }

  const handleExport = async () => {
    if (!projectId || !currentProject) return
    const data = await exportProject(projectId)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentProject.name.replace(/\s+/g, '_')}_healtharch.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border px-6 py-3 flex items-center gap-4">
        <button onClick={() => navigate(`/project/${projectId}/start`)} className="text-muted hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-accent" />
          <span className="text-sm text-muted">{currentProject?.name || 'Project'}</span>
          <span className="text-muted">/</span>
          <span className="text-sm text-white">Upload Design</span>
        </div>
        <div className="ml-auto">
          <button
            onClick={handleExport}
            disabled={files.length === 0}
            className="flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Download size={15} />
            Export for Revit
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-8 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">Upload Existing Design</h1>
          <p className="text-muted">Upload floor plans, CAD files, or program documents. All files are stored with your project and included in the Revit export.</p>
        </div>

        <FileUpload projectId={projectId!} onFilesUploaded={handleFilesUploaded} />

        {files.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
                Uploaded Files ({files.length})
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle size={13} />
                Saved to project
              </div>
            </div>
            <div className="space-y-3">
              {files.map(file => (
                <div key={file.id} className="bg-panel border border-border rounded-xl p-5 flex items-start gap-4">
                  <div className="text-2xl mt-0.5">{TYPE_ICON[file.file_type] || '📎'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium truncate">{file.original_name}</div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted">{file.file_type.toUpperCase()}</span>
                      <span className="text-xs text-muted">{(file.file_size / 1024).toFixed(1)} KB</span>
                      <span className="text-xs text-muted">
                        {new Date(file.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {file.parsed_data && file.parsed_data.status !== 'stored' && (
                      <div className="mt-2 text-xs text-muted bg-surface rounded-lg px-3 py-2">
                        {!!file.parsed_data.entity_types && (
                          <span className="text-blue-400">
                            DXF: {Object.entries(file.parsed_data.entity_types as Record<string, number>)
                              .map(([k, v]) => `${v} ${k}`).join(', ')}
                          </span>
                        )}
                        {!!file.parsed_data.page_count && (
                          <span className="text-red-400">{String(file.parsed_data.page_count)} pages parsed</span>
                        )}
                        {!!file.parsed_data.rows && (
                          <span className="text-yellow-400">{String(file.parsed_data.rows)} rows</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 flex-none">
                    <CheckCircle size={13} />
                    Saved
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 bg-panel border border-border rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center flex-none">
              <Layers size={18} className="text-accent" />
            </div>
            <div>
              <h3 className="text-white font-medium mb-1">Ready for Revit</h3>
              <p className="text-muted text-sm leading-relaxed">
                Once you've uploaded your files, export the project JSON. Your Revit plugin or Dynamo script can load this file to access all project data, site intelligence, and uploaded documents.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
