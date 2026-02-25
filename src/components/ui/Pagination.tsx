import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
    if (totalPages <= 1) return null;

    const pages: (number | '...')[] = [];
    const delta = 1;

    for (let i = 0; i < totalPages; i++) {
        if (i === 0 || i === totalPages - 1 || (i >= page - delta && i <= page + delta)) {
            pages.push(i);
        } else if (pages[pages.length - 1] !== '...') {
            pages.push('...');
        }
    }

    return (
        <div className="flex items-center justify-between px-1 py-3">
            <p className="text-sm text-surface-500">
                Page <span className="font-medium">{page + 1}</span> of{' '}
                <span className="font-medium">{totalPages}</span>
            </p>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => onPageChange(page - 1)}
                    disabled={page === 0}
                    className="btn-ghost btn-sm"
                >
                    <ChevronLeft size={16} />
                </button>
                {pages.map((p, i) =>
                    p === '...' ? (
                        <span key={`dot-${i}`} className="px-2 text-surface-400">
                            …
                        </span>
                    ) : (
                        <button
                            key={p}
                            onClick={() => onPageChange(p)}
                            className={`btn-sm min-w-[2rem] ${p === page
                                    ? 'bg-primary-600 text-white rounded-lg'
                                    : 'btn-ghost'
                                }`}
                        >
                            {p + 1}
                        </button>
                    ),
                )}
                <button
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages - 1}
                    className="btn-ghost btn-sm"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
    );
}
