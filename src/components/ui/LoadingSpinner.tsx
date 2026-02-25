import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
    size?: number;
    className?: string;
}

export default function LoadingSpinner({ size = 24, className = '' }: LoadingSpinnerProps) {
    return (
        <Loader2
            size={size}
            className={`animate-spin text-primary-500 ${className}`}
        />
    );
}

export function PageLoader() {
    return (
        <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
                <LoadingSpinner size={32} />
                <p className="text-sm text-surface-500">Loading...</p>
            </div>
        </div>
    );
}
