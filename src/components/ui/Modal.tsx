import { X } from 'lucide-react';
import { useEffect } from 'react';

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    maxWidth?: string;
}

export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }: ModalProps) {
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [open]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-surface-950/40 backdrop-blur-sm"
                onClick={onClose}
            />
            {/* Panel */}
            <div
                className={`relative bg-white rounded-2xl shadow-2xl w-full ${maxWidth} max-h-[90vh] flex flex-col animate-in zoom-in-95 fade-in duration-200`}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
                    <h2 className="text-lg font-semibold text-surface-900">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>
                {/* Body */}
                <div className="px-6 py-5 overflow-y-auto">{children}</div>
            </div>
        </div>
    );
}
