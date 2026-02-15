import { API_ENDPOINTS } from './config'

export interface UploadSvgParams {
  file: File
  vtraceConfigCode?: string
  rembgConfigCode?: string
}

export interface UploadProgressCallback {
  onProgress?: (percent: number) => void
  onProcessing?: () => void
}

/**
 * Upload an image to the SVG conversion API.
 * Returns an object with the SVG response text and an `abort` function.
 */
export function uploadImageForSvg(
  params: UploadSvgParams,
  callbacks?: UploadProgressCallback,
): { promise: Promise<string>; abort: () => void } {
  const { file, vtraceConfigCode = 'VC001', rembgConfigCode = 'RB003' } = params

  const formData = new FormData()
  formData.append('file', file)
  formData.append('vtraceConfigCode', vtraceConfigCode)
  formData.append('rembgConfigCode', rembgConfigCode)

  const xhr = new XMLHttpRequest()

  const promise = new Promise<string>((resolve, reject) => {
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = (e.loaded / e.total) * 100
        callbacks?.onProgress?.(percent)
        if (percent >= 100) {
          callbacks?.onProcessing?.()
        }
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.responseText)
      } else {
        reject(new Error(`Server returned ${xhr.status}: ${xhr.statusText}`))
      }
    })

    xhr.addEventListener('error', () => {
      reject(new Error('Network error. Please check your connection and try again.'))
    })

    xhr.addEventListener('abort', () => {
      reject(new DOMException('Upload cancelled', 'AbortError'))
    })

    xhr.open('POST', API_ENDPOINTS.svgConversion)
    xhr.send(formData)
  })

  return {
    promise,
    abort: () => xhr.abort(),
  }
}
