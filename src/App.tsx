import { useState, useCallback, useRef } from 'react'
import { Flex } from '@radix-ui/themes'
import { Toolbar } from './components/Toolbar'
import { ResultViewer } from './components/ResultViewer'
import { ColorPalettePanel } from './components/ColorPalettePanel'
import { VectorizeProgressDialog } from './components/VectorizeProgressDialog'
import './App.css'


const MIN_ZOOM = 0.1
const MAX_ZOOM = 10
const ZOOM_STEP = 0.25

const traceWorker = new Worker(
  new URL('./workers/ImageTraceWorker.ts', import.meta.url),
  { type: 'module' }
);

let nextMsgId = 0;
function traceImageInWorker(data: Uint8Array): Promise<string> {
  return new Promise((resolve, reject) => {
    const id = nextMsgId++;
    const handler = (e: MessageEvent) => {
      if (e.data.id !== id) return;
      traceWorker.removeEventListener('message', handler);
      if (e.data.error) {
        reject(new Error(e.data.error));
      } else {
        resolve(e.data.svg);
      }
    };
    traceWorker.addEventListener('message', handler);
    traceWorker.postMessage({ id, data });
  });
}

function App() {
  const [showPalette, setShowPalette] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [svgContent, setSvgContent] = useState<string | null>(null)
  const [uploadFileName, setUploadFileName] = useState<string | null>(null)

  // Upload state
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<'processing' | 'done' | 'error'>('processing')
  const [uploadError, setUploadError] = useState<string | undefined>()

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

  const handleUpload = useCallback(async (file: File) => {
    setUploadFileName(file.name)
    setUploadOpen(true)
    setUploadProgress(0)
    setUploadStatus('processing')
    setUploadError(undefined)
    // Baca file sebagai Uint8Array
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    try {
      const svg = await traceImageInWorker(data);
      setSvgContent(svg);
      setUploadStatus('done')
      setTimeout(() => setUploadOpen(false), 600)
    } catch (err) {
      setUploadStatus('error')
      setUploadError(err instanceof Error ? err.message : String(err))
      console.error('Tracing failed:', err);
    }
  }, [])

  const handleUploadCancel = useCallback(() => {
    setUploadOpen(false)
  }, [])

  const handleDownload = useCallback(() => {
    if (!svgContent) return
    const blob = new Blob([svgContent], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const baseName = uploadFileName
      ? uploadFileName.replace(/\.[^.]+$/, '')
      : 'vectorized'
    a.href = url
    a.download = `${baseName}.svg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [svgContent, uploadFileName])

  return (
    <Flex direction="column" style={{ height: '100vh', width: '100vw', backgroundColor: '#f5f5f5' }}>
      <Toolbar
        onPaletteToggle={() => setShowPalette((v) => !v)}
        paletteOpen={showPalette}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        zoom={zoom}
        onUpload={handleUpload}
        onDownload={handleDownload}
        hasResult={!!svgContent}
      />
      <ResultViewer zoom={zoom} onWheelZoom={handleWheelZoom} svgContent={svgContent} fileName={uploadFileName} />
      {showPalette && <ColorPalettePanel onClose={() => setShowPalette(false)} />}
      <VectorizeProgressDialog
        open={uploadOpen}
        progress={uploadProgress}
        status={uploadStatus}
        fileName={uploadFileName ?? undefined}
        errorMessage={uploadError}
        onCancel={handleUploadCancel}
      />
    </Flex>
  )
}

export default App