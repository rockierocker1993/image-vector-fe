import { Flex, Text, Button } from '@radix-ui/themes'
import { X } from 'lucide-react'
import './UploadProgressDialog.css'

interface UploadProgressDialogProps {
  open: boolean
  progress: number
  status: 'uploading' | 'processing' | 'done' | 'error'
  fileName?: string
  errorMessage?: string
  onCancel?: () => void
}

export function UploadProgressDialog({
  open,
  progress,
  status,
  fileName,
  errorMessage,
  onCancel,
}: UploadProgressDialogProps) {
  if (!open) return null

  const statusText = {
    uploading: 'Uploading...',
    processing: 'Processing image...',
    done: 'Conversion complete!',
    error: 'Upload failed',
  }

  return (
    <div className="upload-overlay">
      <div className="upload-dialog">
        {status !== 'done' && status !== 'error' && (
          <div className="upload-spinner" />
        )}

        <Text as="p" size="4" weight="bold" mb="1">
          {statusText[status]}
        </Text>

        {fileName && (
          <Text as="p" size="2" color="gray" mb="3">
            {fileName}
          </Text>
        )}

        {status === 'error' && errorMessage && (
          <Text as="p" size="2" color="red" mb="3">
            {errorMessage}
          </Text>
        )}

        {(status === 'uploading' || status === 'processing') && (
          <>
            <div className="upload-progress-bar-track">
              <div
                className="upload-progress-bar-fill"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <Text as="p" size="1" color="gray" mt="2">
              {Math.round(progress)}%
            </Text>
          </>
        )}

        <Flex justify="center" mt="4" gap="2">
          {(status === 'uploading' || status === 'processing') && onCancel && (
            <Button
              variant="soft"
              color="gray"
              onClick={onCancel}
              style={{ cursor: 'pointer' }}
            >
              <X size={16} />
              Cancel
            </Button>
          )}
          {status === 'error' && onCancel && (
            <Button
              variant="soft"
              color="gray"
              onClick={onCancel}
              style={{ cursor: 'pointer' }}
            >
              Close
            </Button>
          )}
        </Flex>
      </div>
    </div>
  )
}
