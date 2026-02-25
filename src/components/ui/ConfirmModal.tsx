import Modal from './Modal';

interface ConfirmModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    variant?: 'danger' | 'success';
    loading?: boolean;
}

export default function ConfirmModal({
    open,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    variant = 'danger',
    loading = false,
}: ConfirmModalProps) {
    return (
        <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-sm">
            <p className="text-sm text-surface-600 mb-6">{message}</p>
            <div className="flex gap-3 justify-end">
                <button onClick={onClose} className="btn-secondary" disabled={loading}>
                    Cancel
                </button>
                <button
                    onClick={onConfirm}
                    className={variant === 'danger' ? 'btn-danger' : 'btn-success'}
                    disabled={loading}
                >
                    {loading ? 'Processing...' : confirmText}
                </button>
            </div>
        </Modal>
    );
}
