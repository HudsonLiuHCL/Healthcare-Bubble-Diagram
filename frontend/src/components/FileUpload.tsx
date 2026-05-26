import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, File, CheckCircle, X, Loader } from 'lucide-react'
import { uploadFile } from '../api/client'

export interface UploadedFile {
  id: string
  original_name: string
  file_type: string
  file_size: number
  created_at?: string
  parsed_data: Record<string, unknown>
}

interface Props {
  projectId: string
  onFilesUploaded: (files: UploadedFile[]) => void
}

const FILE_TYPE_COLOR: Record<string, string> = {
  dxf: 'text-blue-400',
  pdf: 'text-red-400',
  image: 'text-green-400',
  spreadsheet: 'text-yellow-400',
  text: 'text-muted',
  document: 'text-purple-400',
}

export default function FileUpload({ projectId, onFilesUploaded }: Props) {
  const [uploads, setUploads] = useState<Array<{
    file: File; status: 'uploading' | 'done' | 'error'; result?: UploadedFile
  }>>([])

  const onDrop = useCallback(async (accepted: File[]) => {
    const newItems = accepted.map(file => ({ file, status: 'uploading' as const }))
    setUploads(prev => [...prev, ...newItems])

    const results: UploadedFile[] = []
    for (const item of newItems) {
      try {
        const result = await uploadFile(projectId, item.file)
        setUploads(prev =>
          prev.map(u => u.file === item.file ? { ...u, status: 'done', result } : u)
        )
        results.push(result)
      } catch {
        setUploads(prev =>
          prev.map(u => u.file === item.file ? { ...u, status: 'error' } : u)
        )
      }
    }
    if (results.length > 0) onFilesUploaded(results)
  }, [projectId])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
    },
    multiple: true,
  })

  const removeUpload = (file: File) => {
    setUploads(prev => prev.filter(u => u.file !== file))
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl px-8 py-12 text-center cursor-pointer transition-all ${
          isDragActive
            ? 'border-accent bg-accent/10'
            : 'border-border hover:border-accent/40 hover:bg-accent/5'
        }`}
      >
        <input {...getInputProps()} />
        <Upload size={40} className={`mx-auto mb-4 ${isDragActive ? 'text-accent' : 'text-muted'}`} />
        <p className="text-white font-medium mb-1">
          {isDragActive ? 'Drop files here' : 'Drop files or click to upload'}
        </p>
        <p className="text-muted text-sm">PDF, DXF, images, spreadsheets</p>
      </div>

      {uploads.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploads.map(({ file, status, result }) => (
            <div key={file.name} className="flex items-center gap-3 bg-panel border border-border rounded-xl px-4 py-3">
              <File size={16} className={FILE_TYPE_COLOR[result?.file_type || 'text'] || 'text-muted'} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{file.name}</div>
                <div className="text-xs text-muted">
                  {(file.size / 1024).toFixed(1)} KB
                  {result?.file_type && ` · ${result.file_type.toUpperCase()}`}
                </div>
              </div>
              {status === 'uploading' && <Loader size={16} className="text-accent animate-spin flex-none" />}
              {status === 'done' && <CheckCircle size={16} className="text-emerald-400 flex-none" />}
              {status === 'error' && <span className="text-xs text-red-400">Failed</span>}
              <button onClick={() => removeUpload(file)} className="text-muted hover:text-white">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
