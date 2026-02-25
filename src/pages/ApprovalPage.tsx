import { useEffect, useState } from 'react';
import { Check, X, Eye, FileText, AlertTriangle } from 'lucide-react';
import { attendanceService } from '../services/attendanceService';
import type { AttendanceResponse } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import Pagination from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import { PageLoader } from '../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

export default function ApprovalPage() {
    const [records, setRecords] = useState<AttendanceResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [detailRecord, setDetailRecord] = useState<AttendanceResponse | null>(null);
    const [approveTarget, setApproveTarget] = useState<AttendanceResponse | null>(null);
    const [rejectTarget, setRejectTarget] = useState<AttendanceResponse | null>(null);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        loadRecords();
    }, [page]);

    const loadRecords = async () => {
        setLoading(true);
        try {
            const res = await attendanceService.getAll({ status: 'PENDING', page, size: 20 });
            if (res.success) {
                setRecords(res.data.content);
                setTotalPages(res.data.totalPages);
            }
        } catch {
            toast.error('Failed to load pending records');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!approveTarget) return;
        setProcessing(true);
        try {
            await attendanceService.approve(approveTarget.id);
            toast.success('Attendance approved');
            setApproveTarget(null);
            loadRecords();
        } catch {
            toast.error('Failed to approve');
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!rejectTarget) return;
        setProcessing(true);
        try {
            await attendanceService.reject(rejectTarget.id);
            toast.success('Attendance rejected');
            setRejectTarget(null);
            loadRecords();
        } catch {
            toast.error('Failed to reject');
        } finally {
            setProcessing(false);
        }
    };

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    const formatTime = (dt: string | null) => {
        if (!dt) return '—';
        return new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    if (loading && records.length === 0) return <PageLoader />;

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-surface-900">Pending Approvals</h1>
                <p className="text-sm text-surface-500 mt-1">
                    Review late & outstation attendance requests
                </p>
            </div>

            {records.length === 0 && !loading ? (
                <div className="card p-12 text-center">
                    <Check size={48} className="mx-auto text-success-500 mb-3" />
                    <h3 className="text-lg font-semibold text-surface-900">All caught up!</h3>
                    <p className="text-sm text-surface-500 mt-1">No pending approvals at the moment.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {records.map((r) => (
                        <div key={r.id} className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="font-semibold text-surface-900">{r.userName}</p>
                                    <span className="text-xs text-surface-400">({r.employeeId})</span>
                                    {r.clockInType && <StatusBadge status={r.clockInType} />}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-surface-500">
                                    <span>{formatDate(r.attendanceDate)}</span>
                                    <span>Clock-in: {formatTime(r.clockInTime)}</span>
                                    {r.officeAreaName && <span>📍 {r.officeAreaName}</span>}
                                </div>
                                {r.reason && (
                                    <div className="mt-2 flex items-start gap-2 text-sm">
                                        <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                                        <p className="text-surface-600 line-clamp-2">{r.reason}</p>
                                    </div>
                                )}
                                {r.documentUrl && (
                                    <a
                                        href={r.documentUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 mt-1 text-xs text-primary-600 hover:underline"
                                    >
                                        <FileText size={12} />
                                        View attachment
                                    </a>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => setDetailRecord(r)}
                                    className="btn-ghost btn-sm"
                                    title="View details"
                                >
                                    <Eye size={16} />
                                </button>
                                <button
                                    onClick={() => setApproveTarget(r)}
                                    className="btn-success btn-sm"
                                >
                                    <Check size={16} />
                                    Approve
                                </button>
                                <button
                                    onClick={() => setRejectTarget(r)}
                                    className="btn-danger btn-sm"
                                >
                                    <X size={16} />
                                    Reject
                                </button>
                            </div>
                        </div>
                    ))}

                    <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                </div>
            )}

            {/* Detail modal */}
            <Modal
                open={!!detailRecord}
                onClose={() => setDetailRecord(null)}
                title="Attendance Details"
                maxWidth="max-w-2xl"
            >
                {detailRecord && (
                    <div className="space-y-4 text-sm">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-surface-400">Employee</span>
                                <p className="font-medium">{detailRecord.userName}</p>
                            </div>
                            <div>
                                <span className="text-surface-400">Date</span>
                                <p>{formatDate(detailRecord.attendanceDate)}</p>
                            </div>
                            <div>
                                <span className="text-surface-400">Clock In</span>
                                <p>{formatTime(detailRecord.clockInTime)}</p>
                            </div>
                            <div>
                                <span className="text-surface-400">Type</span>
                                <div>{detailRecord.clockInType ? <StatusBadge status={detailRecord.clockInType} /> : '—'}</div>
                            </div>
                            <div>
                                <span className="text-surface-400">GPS (In)</span>
                                <p className="font-mono text-xs">
                                    {detailRecord.clockInLat != null
                                        ? `${detailRecord.clockInLat}, ${detailRecord.clockInLng}`
                                        : '—'}
                                </p>
                            </div>
                            <div>
                                <span className="text-surface-400">Selfie</span>
                                {detailRecord.clockInPhotoUrl ? (
                                    <a href={detailRecord.clockInPhotoUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                                        View photo
                                    </a>
                                ) : <p>—</p>}
                            </div>
                        </div>
                        {detailRecord.reason && (
                            <div className="bg-amber-50 p-3 rounded-lg">
                                <span className="text-amber-700 font-medium text-xs">Reason</span>
                                <p className="text-amber-800 mt-0.5">{detailRecord.reason}</p>
                            </div>
                        )}
                        {detailRecord.documentUrl && (
                            <a
                                href={detailRecord.documentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-primary-600 hover:underline"
                            >
                                <FileText size={14} />
                                View attached document
                            </a>
                        )}

                        <div className="flex gap-3 justify-end pt-4 border-t border-surface-100">
                            <button onClick={() => { setDetailRecord(null); setApproveTarget(detailRecord); }} className="btn-success">
                                <Check size={16} /> Approve
                            </button>
                            <button onClick={() => { setDetailRecord(null); setRejectTarget(detailRecord); }} className="btn-danger">
                                <X size={16} /> Reject
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Approve confirm */}
            <ConfirmModal
                open={!!approveTarget}
                onClose={() => setApproveTarget(null)}
                onConfirm={handleApprove}
                title="Approve Attendance"
                message={`Approve ${approveTarget?.userName}'s ${approveTarget?.clockInType?.toLowerCase()} attendance for ${approveTarget ? formatDate(approveTarget.attendanceDate) : ''}?`}
                confirmText="Approve"
                variant="success"
                loading={processing}
            />

            {/* Reject confirm */}
            <ConfirmModal
                open={!!rejectTarget}
                onClose={() => setRejectTarget(null)}
                onConfirm={handleReject}
                title="Reject Attendance"
                message={`Reject ${rejectTarget?.userName}'s ${rejectTarget?.clockInType?.toLowerCase()} attendance for ${rejectTarget ? formatDate(rejectTarget.attendanceDate) : ''}?`}
                confirmText="Reject"
                variant="danger"
                loading={processing}
            />
        </div>
    );
}
