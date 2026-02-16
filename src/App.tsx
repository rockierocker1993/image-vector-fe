import { useState, useCallback, useRef } from 'react'
import { Flex } from '@radix-ui/themes'
import { Toolbar } from './components/Toolbar'
import { ResultViewer } from './components/ResultViewer'
import { ColorPalettePanel } from './components/ColorPalettePanel'
// import { UploadProgressDialog } from './components/UploadProgressDialog'
import { VectorizeProgressDialog } from './components/VectorizeProgressDialog'
import { uploadImageForSvg } from './api'
import * as VectorTracer from "vectortracer";
import './App.css'


const MIN_ZOOM = 0.1
const MAX_ZOOM = 10
const ZOOM_STEP = 0.25

function App() {
  const [showPalette, setShowPalette] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [svgContent, setSvgContent] = useState<string | null>(null)
  const [uploadFileName, setUploadFileName] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Upload state
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<'processing' | 'done' | 'error'>('processing')
  const [uploadError, setUploadError] = useState<string | undefined>()
  const xhrRef = useRef<{ abort: () => void } | null>(null)
  const closeDialogTimerRef = useRef<number | null>(null)

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

  // const handleUpload = useCallback((file: File) => {
  //   setUploadFileName(file.name)
  //   setUploadOpen(true)
  //   setUploadProgress(0)
  //   setUploadStatus('uploading')
  //   setUploadError(undefined)

  //   const { promise, abort } = uploadImageForSvg(
  //     { file },
  //     {
  //       onProgress: (percent) => setUploadProgress(percent),
  //       onProcessing: () => setUploadStatus('processing'),
  //     },
  //   )

  //   xhrRef.current = { abort }

  //   promise
  //     .then((svg) => {
  //       setSvgContent(svg)
  //       setUploadStatus('done')
  //       setTimeout(() => setUploadOpen(false), 600)
  //     })
  //     .catch((err) => {
  //       if (err instanceof DOMException && err.name === 'AbortError') {
  //         setUploadOpen(false)
  //       } else {
  //         setUploadStatus('error')
  //         setUploadError(err.message)
  //       }
  //     })
  //     .finally(() => {
  //       xhrRef.current = null
  //     })
  // }, [])

  const handleUploadCancel = useCallback(() => {
    if (closeDialogTimerRef.current !== null) {
      window.clearTimeout(closeDialogTimerRef.current)
      closeDialogTimerRef.current = null
    }

    xhrRef.current?.abort()
    xhrRef.current = null
    setUploadOpen(false)
  }, [])

  const handleUpload = useCallback((file: File) => {
    if (closeDialogTimerRef.current !== null) {
      window.clearTimeout(closeDialogTimerRef.current)
      closeDialogTimerRef.current = null
    }

    xhrRef.current?.abort()
    setUploadFileName(file.name)
    setUploadOpen(true)
    setUploadProgress(0)
    setUploadStatus('processing')
    setUploadError(undefined)

    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.src = objectUrl

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      setUploadStatus('error')
      setUploadError('Failed to load image file')
      xhrRef.current = null
    }

    img.onload = () => {
      requestAnimationFrame(() => {
        URL.revokeObjectURL(objectUrl)

      const canvas = canvasRef.current
      if (!canvas) {
        setUploadStatus('error')
        setUploadError('Canvas is not available')
        xhrRef.current = null
        return
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setUploadStatus('error')
        setUploadError('Failed to initialize canvas context')
        xhrRef.current = null
        return
      }

      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      const sourceImageData = ctx.getImageData(0, 0, img.width, img.height)
      const binaryPixels = new Uint8ClampedArray(sourceImageData.data.length)

      let luminanceSum = 0
      let visibleCount = 0
      let darkCount = 0

      for (let i = 0; i < sourceImageData.data.length; i += 4) {
        const r = sourceImageData.data[i]
        const g = sourceImageData.data[i + 1]
        const b = sourceImageData.data[i + 2]
        const a = sourceImageData.data[i + 3]
        if (a < 8) continue

        const luminance = 0.299 * r + 0.587 * g + 0.114 * b
        luminanceSum += luminance
        visibleCount += 1
      }

      const averageLuminance = visibleCount > 0 ? luminanceSum / visibleCount : 160
      const threshold = Math.min(210, Math.max(45, averageLuminance))

      for (let i = 0; i < sourceImageData.data.length; i += 4) {
        const r = sourceImageData.data[i]
        const g = sourceImageData.data[i + 1]
        const b = sourceImageData.data[i + 2]
        const a = sourceImageData.data[i + 3]
        if (a < 8) continue

        const luminance = 0.299 * r + 0.587 * g + 0.114 * b
        if (luminance < threshold) darkCount += 1
      }

      const foregroundIsDark = visibleCount > 0 ? darkCount <= visibleCount / 2 : true

      const buildBinaryWithPolarity = (preferDarkForeground: boolean) => {
        let foregroundPixels = 0

        for (let i = 0; i < binaryPixels.length; i += 4) {
          const r = sourceImageData.data[i]
          const g = sourceImageData.data[i + 1]
          const b = sourceImageData.data[i + 2]
          const a = sourceImageData.data[i + 3]

          const luminance = 0.299 * r + 0.587 * g + 0.114 * b
          const isDark = luminance < threshold
          const isForeground = a >= 8 && (preferDarkForeground ? isDark : !isDark)

          if (isForeground) {
            foregroundPixels += 1
          }

          const value = isForeground ? 0 : 255
          binaryPixels[i] = value
          binaryPixels[i + 1] = value
          binaryPixels[i + 2] = value
          binaryPixels[i + 3] = 255
        }

        const totalPixels = img.width * img.height
        return totalPixels > 0 ? foregroundPixels / totalPixels : 0
      }

      let foregroundRatio = buildBinaryWithPolarity(foregroundIsDark)
      if (foregroundRatio < 0.01 || foregroundRatio > 0.9) {
        foregroundRatio = buildBinaryWithPolarity(!foregroundIsDark)
      }

      const binaryImageData = new ImageData(binaryPixels, img.width, img.height)

      const converterOptionsList: VectorTracer.BinaryImageConverterParams[] = [
        {
          debug: false,
          mode: 'none',
          cornerThreshold: 40,
          lengthThreshold: 6,
          maxIterations: 4,
          spliceThreshold: 20,
          filterSpeckle: 4,
          pathPrecision: 3,
        },
        {
          debug: false,
          mode: 'polygon',
          cornerThreshold: 30,
          lengthThreshold: 6,
          maxIterations: 6,
          spliceThreshold: 20,
          filterSpeckle: 8,
          pathPrecision: 3,
        },
      ]

      const additionalOptions: VectorTracer.Options = {
        invert: true,
        pathFill: '#111111',
        backgroundColor: 'transparent',
        attributes: undefined,
        scale: 1,
      }

      let aborted = false
      let activeRelease: (() => void) | null = null

      const normalizeSvgViewport = (svgString: string) => {
        try {
          const parser = new DOMParser()
          const xmlDoc = parser.parseFromString(svgString, 'image/svg+xml')
          const svgEl = xmlDoc.documentElement

          if (svgEl.tagName.toLowerCase() !== 'svg') {
            return svgString
          }

          const width = img.width
          const height = img.height

          svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`)
          svgEl.setAttribute('width', `${width}`)
          svgEl.setAttribute('height', `${height}`)
          svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet')
          svgEl.setAttribute('overflow', 'visible')

          const allElements = Array.from(svgEl.children)
          const rects = Array.from(svgEl.querySelectorAll('rect'))

          for (const rect of rects) {
            const x = Number.parseFloat(rect.getAttribute('x') ?? '0')
            const y = Number.parseFloat(rect.getAttribute('y') ?? '0')
            const rectWidth = Number.parseFloat(rect.getAttribute('width') ?? '0')
            const rectHeight = Number.parseFloat(rect.getAttribute('height') ?? '0')
            const fill = (rect.getAttribute('fill') ?? '').toLowerCase()
            const opacity = Number.parseFloat(rect.getAttribute('fill-opacity') ?? '1')

            const coversCanvas =
              Number.isFinite(rectWidth) &&
              Number.isFinite(rectHeight) &&
              Math.abs(x) <= 1 &&
              Math.abs(y) <= 1 &&
              rectWidth >= width * 0.98 &&
              rectHeight >= height * 0.98

            const visibleFill = fill !== 'none' && opacity > 0
            const hasOtherShapes = allElements.length > 1

            if (coversCanvas && visibleFill && hasOtherShapes) {
              rect.remove()
              break
            }
          }

          return new XMLSerializer().serializeToString(svgEl)
        } catch {
          return svgString
        }
      }

      const finalizeSuccess = (svgString: string) => {
        const normalizedSvg = normalizeSvgViewport(svgString)
        activeRelease = null
        xhrRef.current = null
        setSvgContent(normalizedSvg)
        setUploadProgress(100)
        setUploadStatus('done')
        closeDialogTimerRef.current = window.setTimeout(() => {
          setUploadOpen(false)
          closeDialogTimerRef.current = null
        }, 600)
      }

      const fallbackToServer = (lastError?: unknown) => {
        if (aborted) return

        setUploadStatus('processing')
        setUploadProgress(0)

        const { promise, abort } = uploadImageForSvg(
          { file },
          {
            onProgress: (percent) => setUploadProgress(Math.min(99, Math.max(0, percent))),
            onProcessing: () => setUploadStatus('processing'),
          },
        )

        xhrRef.current = { abort }

        promise
          .then((svg) => {
            if (aborted) return
            finalizeSuccess(svg)
          })
          .catch((err) => {
            if (err instanceof DOMException && err.name === 'AbortError') {
              return
            }

            const fallbackMessage = err instanceof Error ? err.message : 'Vectorization failed'
            const localMessage =
              lastError instanceof Error ? `Local trace failed: ${lastError.message}. ` : ''

            xhrRef.current = null
            setUploadStatus('error')
            setUploadError(`${localMessage}${fallbackMessage}`)
          })
      }

      xhrRef.current = {
        abort: () => {
          if (aborted) return
          aborted = true
          activeRelease?.()
          activeRelease = null
        },
      }

      const failConversion = (error: unknown) => {
        fallbackToServer(error)
      }

      const runAttempt = (attemptIndex: number) => {
        if (aborted) return

        let converter: VectorTracer.BinaryImageConverter
        try {
          converter = new VectorTracer.BinaryImageConverter(
            binaryImageData,
            converterOptionsList[attemptIndex],
            additionalOptions,
          )
        } catch (error) {
          failConversion(error)
          return
        }

        let released = false
        const safeRelease = () => {
          if (released) return
          released = true
          try {
            converter.free()
          } catch {
          }
        }
        activeRelease = safeRelease

        try {
          converter.init()
        } catch (error) {
          safeRelease()
          activeRelease = null
          if (attemptIndex < converterOptionsList.length - 1 && !aborted) {
            setUploadProgress(0)
            runAttempt(attemptIndex + 1)
            return
          }
          failConversion(error)
          return
        }

        const tick = () => {
          if (aborted) {
            return
          }

          try {
            const done = converter.tick()
            const rawProgress = converter.progress()
            const normalizedProgress = rawProgress <= 1 ? rawProgress * 100 : rawProgress
            setUploadProgress(Math.min(99, Math.max(0, normalizedProgress)))

            if (!done) {
              setTimeout(tick, 0)
              return
            }

            const svgString = converter.getResult()
            safeRelease()
            finalizeSuccess(svgString)
          } catch (error) {
            safeRelease()
            activeRelease = null
            if (attemptIndex < converterOptionsList.length - 1 && !aborted) {
              setUploadProgress(0)
              runAttempt(attemptIndex + 1)
              return
            }

            failConversion(error)
          }
        }

        setTimeout(tick, 0)
      }

        runAttempt(0)
      })
    }

  }, []);

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
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </Flex>
  )
}

export default App
