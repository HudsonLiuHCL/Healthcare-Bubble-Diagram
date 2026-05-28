import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import SiteSelection from './pages/SiteSelection'
import StartingPath from './pages/StartingPath'
import BubbleDiagram from './pages/BubbleDiagram'
import UploadDesign from './pages/UploadDesign'
import GoogleAuthButton from './components/GoogleAuthButton'

export default function App() {
  return (
    <BrowserRouter>
      {/* Global sign-in control (bottom-left on every page). */}
      <GoogleAuthButton />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/project/:projectId/site" element={<SiteSelection />} />
        <Route path="/project/:projectId/start" element={<StartingPath />} />
        <Route path="/project/:projectId/bubble" element={<BubbleDiagram />} />
        <Route path="/project/:projectId/upload" element={<UploadDesign />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
