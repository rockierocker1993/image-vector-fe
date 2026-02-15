import { useState, useCallback } from 'react'
import { Flex } from '@radix-ui/themes'
import { Toolbar } from './components/Toolbar'
import { ResultViewer } from './components/ResultViewer'
import { ColorPalettePanel } from './components/ColorPalettePanel'
import './App.css'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 10
const ZOOM_STEP = 0.25

function App() {
  const [showPalette, setShowPalette] = useState(false)
  const [zoom, setZoom] = useState(1)

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))
  }, [])

  const handleZoomReset = useCallback(() => {
    setZoom(1)
  }, [])

  const handleWheelZoom = useCallback((delta: number) => {
    setZoom((z) => {
      const step = delta > 0 ? -0.1 : 0.1
      return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + step))
    })
  }, [])

  return (
    <Flex direction="column" style={{ height: '100vh', width: '100vw', backgroundColor: '#f5f5f5' }}>
      <Toolbar
        onPaletteToggle={() => setShowPalette((v) => !v)}
        paletteOpen={showPalette}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        zoom={zoom}
      />
      <ResultViewer zoom={zoom} onWheelZoom={handleWheelZoom} />
      {showPalette && <ColorPalettePanel onClose={() => setShowPalette(false)} />}
    </Flex>
  )
}

export default App
