import { useEffect, useState } from 'react';
import { Search, Eye, Filter, X } from 'lucide-react';
import { attendanceService, type AttendanceFilters } from '../services/attendanceService';
import type { AttendanceResponse, AttendanceStatus } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import Pagination from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import { PageLoader } from '../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

export default function AttendancePage() {
    const [records, setRecords] = useState<AttendanceResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [detailRecord, setDetailRecord] = useState<AttendanceResponse | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    // Filters
    const [filterStatus, setFilterStatus] = useState<AttendanceStatus | ''>('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [filterUserId, setFilterUserId] = useState('');

    useEffect(() => {
        loadRecords();
    }, [page]);

    const loadRecords = async () => {
        setLoading(true);
        try {
            const filters: AttendanceFilters = { page, size: 20 };
            if (filterStatus) filters.status = filterStatus;
            if (filterStartDate) filters.startDate = filterStartDate;
            if (filterEndDate) filters.endDate = filterEndDate;
            if (filterUserId) filters.userId = parseInt(filterUserId);

            const res = await attendanceService.getAll(filters);
            if (res.success) {
                setRecords(res.data.content);
                setTotalPages(res.data.totalPages);
            }
        } catch {
            toast.error('Failed to load attendance records');
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        setPage(0);
        loadRecords();
    };

    const clearFilters = () => {
        setFilterStatus('');
        setFilterStartDate('');
        setFilterEndDate('');
        setFilterUserId('');
        setPage(0);
        setTimeout(loadRecords, 0);
    };

    const formatTime = (dt: string | null) => {
        if (!dt) return '—';
        return new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (d: string) => {
        return new Date(d).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    if (loading && records.length === 0) return <PageLoader />;

    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900">Attendance Records</h1>
                    <p className="text-sm text-surface-500 mt-1">View all employee attendance</p>
                </div>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="btn-secondary"
                >
                    <Filter size={18} />
                    Filters
                </button>
            </div>

            {/* Filters panel */}
            {showFilters && (
                <div className="card p-4 mb-4">
                    <div className="flex flex-wrap gap-3 items-end">
                        <div>
                            <label className="label">Status</label>
                            <select
                                className="select"
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value as AttendanceStatus | '')}
                            >
                                <option value="">All</option>
                                <option value="PENDING">Pending</option>
                                <option value="APPROVED">Approved</option>
                                <option value="REJECTED">Rejected</option>
                            </select>
                        </div>
                        <div>
                            <label className="label">Start Date</label>
                            <input
                                type="date"
                                className="input"
                                value={filterStartDate}
                                onChange={(e) => setFilterStartDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">End Date</label>
                            <input
                                type="date"
                                className="input"
                                value={filterEndDate}
                                onChange={(e) => setFilterEndDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">User ID</label>
                            <input
                                type="number"
                                className="input"
                                value={filterUserId}
                                onChange={(e) => setFilterUserId(e.target.value)}
                                placeholder="e.g. 1"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button onClick={applyFilters} className="btn-primary btn-sm">
                                <Search size={14} />
                                Apply
                            </button>
                            <button onClick={clearFilters} className="btn-ghost btn-sm">
                                <X size={14} />
                                Clear
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="card table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Employee</th>
                            <th>Clock In</th>
                            <th>Type</th>
                            <th>Clock Out</th>
                            <th>Duration</th>
                            <th>Status</th>
                            <th className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {records.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="text-center py-8 text-surface-400">
                                    No attendance records found
                                </td>
                            </tr>
                        ) : (
                            records.map((r) => (
                                <tr key={r.id}>
                                    <td className="whitespace-nowrap">{formatDate(r.attendanceDate)}</td>
                                    <td>
                                        <div>
                                            <p className="font-medium text-surface-900">{r.userName}</p>
                                            <p className="text-xs text-surface-400">{r.employeeId}</p>
                                        </div>
                                    </td>
                                    <td className="font-mono text-xs">{formatTime(r.clockInTime)}</td>
                                    <td>{r.clockInType ? <StatusBadge status={r.clockInType} /> : '—'}</td>
                                    <td className="font-mono text-xs">{formatTime(r.clockOutTime)}</td>
                                    <td>
                                        {r.workingMinutes != null
                                            ? `${Math.floor(r.workingMinutes / 60)}h ${r.workingMinutes % 60}m`
                                            : '—'}
                                    </td>
                                    <td><StatusBadge status={r.status} /></td>
                                    <td className="text-right">
                                        <button
                                            onClick={() => setDetailRecord(r)}
                                            className="btn-ghost btn-sm"
                                        >
                                            <Eye size={15} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                <div className="px-4">
                    <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                </div>
            </div>

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
                                <p className="font-medium text-surface-900">{detailRecord.userName}</p>
                            </div>
                            <div>
                                <span className="text-surface-400">Employee ID</span>
                                <p className="font-mono">{detailRecord.employeeId}</p>
                            </div>
                            <div>
                                <span className="text-surface-400">Date</span>
                                <p>{formatDate(detailRecord.attendanceDate)}</p>
                            </div>
                            <div>
                                <span className="text-surface-400">Status</span>
                                <div className="mt-0.5"><StatusBadge status={detailRecord.status} /></div>
                            </div>
                            <div>
                                <span className="text-surface-400">Office Area</span>
                                <p>{detailRecord.officeAreaName || '—'}</p>
                            </div>
                            <div>
                                <span className="text-surface-400">Duration</span>
                                <p>
                                    {detailRecord.workingMinutes != null
                                        ? `${Math.floor(detailRecord.workingMinutes / 60)}h ${detailRecord.workingMinutes % 60}m`
                                        : '—'}
                                </p>
                            </div>
                        </div>

                        <hr className="border-surface-100" />

                        {/* Clock In */}
                        <div>
                            <h4 className="font-semibold text-surface-900 mb-2">Clock In</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <span className="text-surface-400">Time</span>
                                    <p>{formatTime(detailRecord.clockInTime)}</p>
                                </div>
                                <div>
                                    <span className="text-surface-400">Type</span>
                                    <div className="mt-0.5">
                                        {detailRecord.clockInType ? <StatusBadge status={detailRecord.clockInType} /> : '—'}
                                    </div>
                                </div>
                                <div>
                                    <span className="text-surface-400">GPS</span>
                                    <p className="font-mono text-xs">
                                        {detailRecord.clockInLat != null
                                            ? `${detailRecord.clockInLat}, ${detailRecord.clockInLng}`
                                            : '—'}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-surface-400">Photo</span>
                                    {detailRecord.clockInPhotoUrl ? (
                                        <a
                                            href={detailRecord.clockInPhotoUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary-600 hover:underline"
                                        >
                                            View photo
                                        </a>
                                    ) : (
                                        <p>—</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Clock Out */}
                        <div>
                            <h4 className="font-semibold text-surface-900 mb-2">Clock Out</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <span className="text-surface-400">Time</span>
                                    <p>{formatTime(detailRecord.clockOutTime)}</p>
                                </div>
                                <div>
                                    <span className="text-surface-400">Type</span>
                                    <div className="mt-0.5">
                                        {detailRecord.clockOutType ? <StatusBadge status={detailRecord.clockOutType} /> : '—'}
                                    </div>
                                </div>
                                <div>
                                    <span className="text-surface-400">GPS</span>
                                    <p className="font-mono text-xs">
                                        {detailRecord.clockOutLat != null
                                            ? `${detailRecord.clockOutLat}, ${detailRecord.clockOutLng}`
                                            : '—'}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-surface-400">Photo</span>
                                    {detailRecord.clockOutPhotoUrl ? (
                                        <a
                                            href={detailRecord.clockOutPhotoUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary-600 hover:underline"
                                        >
                                            View photo
                                        </a>
                                    ) : (
                                        <p>—</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Reason / Document */}
                        {(detailRecord.reason || detailRecord.documentUrl) && (
                            <>
                                <hr className="border-surface-100" />
                                <div>
                                    <h4 className="font-semibold text-surface-900 mb-2">Additional Info</h4>
                                    {detailRecord.reason && (
                                        <div className="mb-2">
                                            <span className="text-surface-400">Reason</span>
                                            <p className="text-surface-700 bg-surface-50 p-3 rounded-lg mt-1">
                                                {detailRecord.reason}
                                            </p>
                                        </div>
                                    )}
                                    {detailRecord.documentUrl && (
                                        <div>
                                            <span className="text-surface-400">Document</span>
                                            <p>
                                                <a
                                                    href={detailRecord.documentUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary-600 hover:underline"
                                                >
                                                    View document
                                                </a>
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Review info */}
                        {detailRecord.reviewedByName && (
                            <>
                                <hr className="border-surface-100" />
                                <div className="bg-surface-50 p-3 rounded-lg">
                                    <span className="text-surface-400 text-xs">Reviewed by</span>
                                    <p className="font-medium text-surface-900">{detailRecord.reviewedByName}</p>
                                    {detailRecord.reviewedAt && (
                                        <p className="text-xs text-surface-400">{new Date(detailRecord.reviewedAt).toLocaleString()}</p>
                                    )}
                                    {detailRecord.notes && (
                                        <p className="text-surface-600 mt-1">{detailRecord.notes}</p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
}
