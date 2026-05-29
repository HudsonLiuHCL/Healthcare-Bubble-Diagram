import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import Home from './pages/Home'
import SiteSelection from './pages/SiteSelection'
import BubbleDiagram from './pages/BubbleDiagram'
import UploadDesign from './pages/UploadDesign'
import CollaborationLanding from './pages/CollaborationLanding'
import ArchitectView from './pages/ArchitectView'
import DoctorView from './pages/DoctorView'
import ExportSession from './pages/ExportSession'

// Redirect /start → /collaborate (kept for any bookmarked URLs)
function StartRedirect() {
  const { projectId } = useParams<{ projectId: string }>()
  return <Navigate to={`/project/${projectId}/collaborate`} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/project/:projectId/site" element={<SiteSelection />} />
        <Route path="/project/:projectId/start" element={<StartRedirect />} />
        <Route path="/project/:projectId/collaborate" element={<CollaborationLanding />} />
        <Route path="/project/:projectId/architect" element={<ArchitectView />} />
        <Route path="/project/:projectId/doctor" element={<DoctorView />} />
        <Route path="/project/:projectId/export" element={<ExportSession />} />
        {/* Legacy routes kept so old links don't 404 */}
        <Route path="/project/:projectId/bubble" element={<BubbleDiagram />} />
        <Route path="/project/:projectId/upload" element={<UploadDesign />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
