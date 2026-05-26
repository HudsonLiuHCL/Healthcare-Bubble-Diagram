import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Activity, ArrowLeft, Loader } from 'lucide-react'
import { confirmSite, getProject } from '../api/client'
import { useProjectStore } from '../store/projectStore'
import MapSelector from '../components/MapSelector'

export default function SiteSelection() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { currentProject, setCurrentProject } = useProjectStore()
  const [isConfirming, setIsConfirming] = useState(false)

  useEffect(() => {
    if (!currentProject && projectId) {
      getProject(projectId).then(setCurrentProject).catch(console.error)
    }
  }, [projectId])

  const handleConfirm = async (data: {
    address: string
    lat: number
    lng: number
    parcel_geojson: object | null
    lot_area_sqm: number
  }) => {
    if (!projectId) return
    setIsConfirming(true)
    try {
      await confirmSite(projectId, {
        address: data.address,
        lat: data.lat,
        lng: data.lng,
        parcel_geojson: data.parcel_geojson ?? undefined,
        lot_area_sqm: data.lot_area_sqm,
      })
      navigate(`/project/${projectId}/start`)
    } catch (e) {
      console.error(e)
      alert('Failed to save site. Is the backend running?')
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-surface">
      {/* Top bar */}
      <header className="flex-none border-b border-border px-6 py-3 flex items-center gap-4 z-10">
        <button onClick={() => navigate('/')} className="text-muted hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-accent" />
          <span className="text-sm text-muted">{currentProject?.name || 'Project'}</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center gap-1.5">
            {['Site', 'Path', 'Program'].map((step, i) => (
              <div key={step} className="flex items-center gap-1.5">
                <div className={`flex items-center gap-1.5 ${i === 0 ? 'text-accent' : 'text-muted'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium border ${i === 0 ? 'border-accent bg-accent text-white' : 'border-border'}`}>
                    {i + 1}
                  </div>
                  <span className="text-xs">{step}</span>
                </div>
                {i < 2 && <div className="w-6 h-px bg-border" />}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Map */}
      <div className="flex-1 relative">
        {isConfirming && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-20 flex items-center justify-center">
            <div className="bg-panel border border-border rounded-2xl p-8 flex flex-col items-center gap-4">
              <Loader size={32} className="text-accent animate-spin" />
              <div className="text-center">
                <p className="text-white font-medium">Confirming site…</p>
                <p className="text-muted text-sm mt-1">Starting background site analysis</p>
              </div>
            </div>
          </div>
        )}
        <MapSelector onSiteConfirmed={handleConfirm} isConfirming={isConfirming} />
      </div>
    </div>
  )
}
