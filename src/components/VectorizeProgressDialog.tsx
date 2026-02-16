import { Flex, Text, Button } from '@radix-ui/themes'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import './VectorizeProgressDialog.css'


interface VectorizeProgressDialogProps {
    open: boolean
    progress: number
    status: 'processing' | 'done' | 'error'
    fileName?: string
    errorMessage?: string
    onCancel?: () => void
}

export function VectorizeProgressDialog({
    open,
    progress,
    status,
    fileName,
    errorMessage,
    onCancel,
}: VectorizeProgressDialogProps) {
    if (!open) return null

    const statusText = {
        processing: 'Processing image...',
        done: 'Conversion complete!',
        error: 'Vectorize failed',
    }

    const content = (
        <div className="vectorize-overlay">
            <div className="vectorize-dialog">
                {status === 'processing' && (
                    <div className="vectorize-spinner" />
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

                {status === 'processing' && (
                    <>
                        <div className="vectorize-progress-bar-track">
                            <div
                                className="vectorize-progress-bar-fill"
                                style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                        </div>
                        <Text as="p" size="1" color="gray" mt="2">
                            {Math.round(progress)}%
                        </Text>
                    </>
                )}

                <Flex justify="center" mt="4" gap="2">
                    {status === 'processing' && onCancel && (
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

    if (typeof document === 'undefined') {
        return content
    }

    return createPortal(content, document.body)
}
