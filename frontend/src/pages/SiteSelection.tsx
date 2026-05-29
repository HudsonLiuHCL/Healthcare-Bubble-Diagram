import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Activity, ArrowLeft, Loader } from 'lucide-react'
import { confirmSite, getProject, getIntelligence } from '../api/client'
import { useProjectStore } from '../store/projectStore'
import MapSelector from '../components/MapSelector'
import StepChain from '../components/StepChain'
import SiteIntelligencePanel from '../components/SiteIntelligencePanel'

export default function SiteSelection() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { currentProject, setCurrentProject } = useProjectStore()
  const [isConfirming, setIsConfirming] = useState(false)
  const [showIntel, setShowIntel] = useState(false)
  const [intelStatus, setIntelStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return
    if (!currentProject) getProject(projectId).then(setCurrentProject).catch(console.error)
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const intel = await getIntelligence(projectId)
        setIntelStatus(intel.status)
        if (intel.status !== 'completed' && intel.status !== 'failed')
          timer = setTimeout(poll, 4000)
      } catch { timer = setTimeout(poll, 5000) }
    }
    poll()
    return () => clearTimeout(timer)
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
      navigate(`/project/${projectId}/collaborate`)
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
      </header>
      <StepChain current="site" projectId={projectId} intelStatus={intelStatus} onSiteAnalysisClick={() => setShowIntel(true)} />

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

      {projectId && (
        <SiteIntelligencePanel isOpen={showIntel} onClose={() => setShowIntel(false)} projectId={projectId} />
      )}
    </div>
  )
}
