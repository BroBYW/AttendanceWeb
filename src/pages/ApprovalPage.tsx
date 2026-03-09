import { useEffect, useState, useMemo, useCallback } from 'react';
import { Check, X, Eye, FileText, AlertTriangle, Map } from 'lucide-react';
import { attendanceService } from '../services/attendanceService';
import { officeAreaService } from '../services/officeAreaService';
import { userService } from '../services/userService';
import type { AttendanceResponse, OfficeAreaResponse } from '../types';
import type { LocationStatusType } from '../components/ui/SinglePointMapModal';
import StatusBadge from '../components/ui/StatusBadge';
import Pagination from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import SinglePointMapModal from '../components/ui/SinglePointMapModal';
import GpsHistoryModal from '../components/ui/GpsHistoryModal';
import { PageLoader } from '../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

export default function ApprovalPage() {
    const [records, setRecords] = useState<AttendanceResponse[]>([]);
    const [officeAreas, setOfficeAreas] = useState<OfficeAreaResponse[]>([]);
    // Map of userId -> assignedOfficeAreaIds for user-aware location status
    const [userAssignments, setUserAssignments] = useState<Record<number, number[]>>({});
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [statusFilter, setStatusFilter] = useState<string>('PENDING');
    const [detailRecord, setDetailRecord] = useState<AttendanceResponse | null>(null);
    const [approveTarget, setApproveTarget] = useState<AttendanceResponse | null>(null);
    const [rejectTarget, setRejectTarget] = useState<AttendanceResponse | null>(null);
    const [processing, setProcessing] = useState(false);
    const [rejectComment, setRejectComment] = useState('');
    const [gpsHistoryUser, setGpsHistoryUser] = useState<{ id: number; name: string } | null>(null);
    const [mapModalData, setMapModalData] = useState<{
        lat: number;
        lng: number;
        title: string;
        time: string | null;
        status: string | null;
        locationStatus: LocationStatusType | null;
    } | null>(null);

    useEffect(() => {
        loadRecords();
        if (officeAreas.length === 0) {
            loadOfficeAreas();
        }
    }, [page, statusFilter]);

    // Fetch user assignments whenever records change
    useEffect(() => {
        if (records.length === 0) return;
        const uniqueUserIds = [...new Set(records.map(r => r.userId))];
        const missingIds = uniqueUserIds.filter(id => !(id in userAssignments));
        if (missingIds.length === 0) return;

        const fetchUsers = async () => {
            try {
                const res = await userService.getAll();
                if (res.success) {
                    const map: Record<number, number[]> = { ...userAssignments };
                    for (const u of res.data) {
                        map[u.id] = u.assignedOfficeAreaIds || [];
                    }
                    setUserAssignments(map);
                }
            } catch (error) {
                console.error('Failed to load user assignments', error);
            }
        };
        fetchUsers();
    }, [records]);

    const loadOfficeAreas = async () => {
        try {
            const res = await officeAreaService.getAll();
            if (res.success) {
                setOfficeAreas(res.data.filter(area => area.status === 'ACTIVE'));
            }
        } catch (error) {
            console.error('Failed to load office areas', error);
        }
    };

    const loadRecords = async () => {
        setLoading(true);
        try {
            const filters: any = { page, size: 20 };
            if (statusFilter !== 'ALL') filters.status = statusFilter;
            const res = await attendanceService.getAll(filters);
            if (res.success) {
                setRecords(res.data.content);
                setTotalPages(res.data.totalPages);
            }
        } catch {
            toast.error('Failed to load records');
        } finally {
            setLoading(false);
        }
    };

    const statusTabs = [
        { value: 'PENDING', label: 'Pending' },
        { value: 'AUTO_APPROVED', label: 'Auto-Approved' },
        { value: 'APPROVED', label: 'Approved' },
        { value: 'REJECTED', label: 'Rejected' },
        { value: 'ALL', label: 'All' },
    ];

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
            await attendanceService.reject(rejectTarget.id, rejectComment || undefined);
            toast.success('Attendance rejected');
            setRejectTarget(null);
            setRejectComment('');
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

    /** Ray-casting point-in-polygon test. ring is [lng, lat] pairs (GeoJSON order). */
    const pointInPolygon = (lat: number, lng: number, ring: number[][]): boolean => {
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const xi = ring[i][1], yi = ring[i][0];
            const xj = ring[j][1], yj = ring[j][0];
            const intersect = ((yi > lng) !== (yj > lng)) &&
                (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    };

    /** Extract polygon rings with their office area ID for user-aware checks */
    const polygonRingsWithArea = useMemo(() => {
        const rings: { officeAreaId: number; ring: number[][] }[] = [];
        for (const area of officeAreas) {
            if (!area.geojsonData) continue;
            try {
                const parsed = JSON.parse(area.geojsonData);
                if (!parsed.features) continue;
                for (const feature of parsed.features) {
                    const geom = feature.geometry;
                    if (geom?.type === 'Polygon' && geom.coordinates?.[0]) {
                        rings.push({ officeAreaId: area.id, ring: geom.coordinates[0] });
                    } else if (geom?.type === 'MultiPolygon') {
                        for (const poly of geom.coordinates) {
                            if (poly[0]) rings.push({ officeAreaId: area.id, ring: poly[0] });
                        }
                    }
                }
            } catch { /* ignore parse errors */ }
        }
        return rings;
    }, [officeAreas]);

    /**
     * 3-tier location status matching backend GpsLogService.determineAreaStatus:
     *  1. Inside an ASSIGNED area → Normal
     *  2. Inside ANY other active area → Outstation
     *  3. Outside all areas → Outside Working Area
     */
    const determineLocationStatus = useCallback(
        (lat: number | null, lng: number | null, userId: number): { status: LocationStatusType, areaName?: string } => {
            if (lat == null || lng == null || polygonRingsWithArea.length === 0) return { status: 'Outside Working Area' };

            const assignedIds = userAssignments[userId] || [];
            let insideAnyArea = false;
            let matchedAreaName = '';

            for (const { officeAreaId, ring } of polygonRingsWithArea) {
                if (pointInPolygon(lat, lng, ring)) {
                    const area = officeAreas.find(a => a.id === officeAreaId);
                    if (assignedIds.includes(officeAreaId)) {
                        return { status: 'Normal', areaName: area?.name };
                    }
                    insideAnyArea = true;
                    matchedAreaName = area?.name || '';
                }
            }

            return { 
                status: insideAnyArea ? 'Outstation' : 'Outside Working Area',
                areaName: insideAnyArea ? matchedAreaName : undefined
            };
        },
        [polygonRingsWithArea, userAssignments, officeAreas]
    );

    /** Derive location status for clock-in using user-aware polygon check */
    const getClockInLocationStatus = (r: AttendanceResponse): { status: LocationStatusType, areaName?: string } => {
        if (polygonRingsWithArea.length > 0 && r.clockInLat != null && r.clockInLng != null) {
            return determineLocationStatus(r.clockInLat, r.clockInLng, r.userId);
        }
        if (r.clockInType === 'OUTSTATION') return { status: 'Outstation', areaName: r.officeAreaName || undefined };
        if (r.inGeofence === false) return { status: 'Outside Working Area' };
        return { status: 'Normal', areaName: r.officeAreaName || undefined };
    };

    /** Derive location status for clock-out using user-aware polygon check */
    const getClockOutLocationStatus = (r: AttendanceResponse): { status: LocationStatusType, areaName?: string } => {
        if (polygonRingsWithArea.length > 0 && r.clockOutLat != null && r.clockOutLng != null) {
            return determineLocationStatus(r.clockOutLat, r.clockOutLng, r.userId);
        }
        if (r.clockOutInGeofence === false) return { status: 'Outside Working Area' };
        return { status: 'Normal', areaName: r.officeAreaName || undefined };
    };

    if (loading && records.length === 0) return <PageLoader />;

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-surface-900">Approvals</h1>
                <p className="text-sm text-surface-500 mt-1">
                    Review & manage attendance requests
                </p>
            </div>

            {/* Status filter tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
                {statusTabs.map(tab => (
                    <button
                        key={tab.value}
                        onClick={() => { setStatusFilter(tab.value); setPage(0); }}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${statusFilter === tab.value
                            ? 'bg-primary-600 text-white shadow-sm'
                            : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
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
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <p className="font-semibold text-surface-900">{r.userName}</p>
                                    <span className="text-xs text-surface-400">({r.employeeId})</span>
                                    {r.clockInType && <StatusBadge status={r.clockInType} />}
                                    {r.clockOutType && <StatusBadge status={r.clockOutType} />}
                                    <StatusBadge status={r.status} />
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-surface-500">
                                    <span>{formatDate(r.attendanceDate)}</span>
                                    {/* Clock In */}
                                    <span className="flex items-center gap-1">
                                        Clock-in: {formatTime(r.clockInTime)}
                                        <div className="flex flex-col items-center">
                                            <span
                                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${getClockInLocationStatus(r).status === 'Normal'
                                                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                                                    : getClockInLocationStatus(r).status === 'Outstation'
                                                        ? 'bg-primary-100 text-primary-700'
                                                        : 'bg-amber-100 text-amber-700'
                                                    }`}
                                            >
                                                {getClockInLocationStatus(r).status}
                                            </span>
                                            {getClockInLocationStatus(r).areaName && (
                                                <span className="text-[10px] text-surface-500">
                                                    ({getClockInLocationStatus(r).areaName})
                                                </span>
                                            )}
                                        </div>
                                        {r.clockInLat && r.clockInLng && (
                                            <button
                                                onClick={() => setMapModalData({
                                                    lat: r.clockInLat!,
                                                    lng: r.clockInLng!,
                                                    title: `Clock In Location: ${r.userName}`,
                                                    time: r.clockInTime ? new Date(r.clockInTime).toLocaleTimeString() : null,
                                                    status: r.clockInType || 'UNKNOWN',
                                                    locationStatus: getClockInLocationStatus(r).status
                                                })}
                                                className="text-primary-600 hover:text-primary-800 hover:underline inline-flex items-center"
                                                title="View Map"
                                            >
                                                (📍 Map)
                                            </button>
                                        )}
                                    </span>
                                    {/* Clock Out */}
                                    <span className="flex items-center gap-1">
                                        Clock-out: {formatTime(r.clockOutTime)}
                                        {r.clockOutTime && (
                                            <div className="flex flex-col items-center">
                                                <span
                                                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${getClockOutLocationStatus(r).status === 'Normal'
                                                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                                                        : getClockOutLocationStatus(r).status === 'Outstation'
                                                            ? 'bg-primary-100 text-primary-700'
                                                            : 'bg-amber-100 text-amber-700'
                                                        }`}
                                                >
                                                    {getClockOutLocationStatus(r).status}
                                                </span>
                                                {getClockOutLocationStatus(r).areaName && (
                                                    <span className="text-[10px] text-surface-500">
                                                        ({getClockOutLocationStatus(r).areaName})
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        {r.clockOutLat && r.clockOutLng && (
                                            <button
                                                onClick={() => setMapModalData({
                                                    lat: r.clockOutLat!,
                                                    lng: r.clockOutLng!,
                                                    title: `Clock Out Location: ${r.userName}`,
                                                    time: r.clockOutTime ? new Date(r.clockOutTime).toLocaleTimeString() : null,
                                                    status: r.clockOutType || 'UNKNOWN',
                                                    locationStatus: getClockOutLocationStatus(r).status
                                                })}
                                                className="text-primary-600 hover:text-primary-800 hover:underline inline-flex items-center"
                                                title="View Map"
                                            >
                                                (📍 Map)
                                            </button>
                                        )}
                                    </span>
                                    {r.officeAreaName && (
                                        <span className="flex items-center gap-1.5">
                                            <span className="text-surface-500 text-xs">Working area:</span>
                                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-blue-100 text-blue-700 border border-blue-200">
                                                {r.officeAreaName}
                                            </span>
                                        </span>
                                    )}
                                </div>
                                {r.reason && (
                                    <div className="mt-2 flex items-start gap-2 text-sm">
                                        <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                                        <p className="text-surface-600 line-clamp-2">{r.reason}</p>
                                    </div>
                                )}
                                {r.documentUrl && (
                                    <a
                                        href={`${import.meta.env.VITE_API_BASE_URL}${r.documentUrl}`}
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
                                    onClick={() => setGpsHistoryUser({ id: r.userId, name: r.userName })}
                                    className="btn-ghost btn-sm text-primary-600 p-1.5 hover:bg-primary-50"
                                    title="View GPS History"
                                >
                                    <Map size={16} />
                                </button>
                                <button
                                    onClick={() => setDetailRecord(r)}
                                    className="btn-ghost btn-sm"
                                    title="View details"
                                >
                                    <Eye size={16} />
                                </button>
                                {r.status === 'PENDING' && <button
                                    onClick={() => setApproveTarget(r)}
                                    className="btn-success btn-sm"
                                >
                                    <Check size={16} />
                                    Approve
                                </button>}
                                {r.status === 'PENDING' && <button
                                    onClick={() => setRejectTarget(r)}
                                    className="btn-danger btn-sm"
                                >
                                    <X size={16} />
                                    Reject
                                </button>}
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
                        {/* Employee & Date */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-surface-400">Employee</span>
                                <p className="font-medium">{detailRecord.userName}</p>
                            </div>
                            <div>
                                <span className="text-surface-400">Date</span>
                                <p>{formatDate(detailRecord.attendanceDate)}</p>
                            </div>
                        </div>

                        {/* Clock In Section */}
                        <div className="border-t border-surface-100 pt-4">
                            <h4 className="font-semibold text-surface-700 mb-3">Clock In</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="text-surface-400">Time</span>
                                    <p>{formatTime(detailRecord.clockInTime)}</p>
                                </div>
                                <div>
                                    <span className="text-surface-400">Type</span>
                                    <div>{detailRecord.clockInType ? <StatusBadge status={detailRecord.clockInType} /> : '—'}</div>
                                </div>
                                <div>
                                    <span className="text-surface-400">Location Status</span>
                                    <div className="mt-1 flex flex-col">
                                        <span
                                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium w-fit ${getClockInLocationStatus(detailRecord).status === 'Normal'
                                                ? 'bg-success-100 text-success-700'
                                                : getClockInLocationStatus(detailRecord).status === 'Outstation'
                                                    ? 'bg-primary-100 text-primary-700'
                                                    : 'bg-amber-100 text-amber-700'
                                                }`}
                                        >
                                            {getClockInLocationStatus(detailRecord).status}
                                        </span>
                                        {getClockInLocationStatus(detailRecord).areaName && (
                                            <span className="text-[10px] text-surface-500 mt-0.5">
                                                ({getClockInLocationStatus(detailRecord).areaName})
                                            </span>
                                        )}
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
                                {detailRecord.clockInPhotoUrl && (
                                    <div className="col-span-2">
                                        <span className="text-surface-400">Selfie</span>
                                        <a href={`${import.meta.env.VITE_API_BASE_URL}${detailRecord.clockInPhotoUrl}`} target="_blank" rel="noopener noreferrer">
                                            <img
                                                src={`${import.meta.env.VITE_API_BASE_URL}${detailRecord.clockInPhotoUrl}`}
                                                alt="Clock-in selfie"
                                                className="mt-1 rounded-lg border border-surface-200 max-h-48 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                            />
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Clock Out Section */}
                        <div className="border-t border-surface-100 pt-4">
                            <h4 className="font-semibold text-surface-700 mb-3">Clock Out</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="text-surface-400">Time</span>
                                    <p>{formatTime(detailRecord.clockOutTime)}</p>
                                </div>
                                <div>
                                    <span className="text-surface-400">Type</span>
                                    <div>{detailRecord.clockOutType ? <StatusBadge status={detailRecord.clockOutType} /> : '—'}</div>
                                </div>
                                {detailRecord.clockOutTime && (
                                    <div>
                                        <span className="text-surface-400">Location Status</span>
                                        <div className="mt-1 flex flex-col">
                                            <span
                                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium w-fit ${getClockOutLocationStatus(detailRecord).status === 'Normal'
                                                    ? 'bg-success-100 text-success-700'
                                                    : getClockOutLocationStatus(detailRecord).status === 'Outstation'
                                                        ? 'bg-primary-100 text-primary-700'
                                                        : 'bg-amber-100 text-amber-700'
                                                    }`}
                                            >
                                                {getClockOutLocationStatus(detailRecord).status}
                                            </span>
                                            {getClockOutLocationStatus(detailRecord).areaName && (
                                                <span className="text-[10px] text-surface-500 mt-0.5">
                                                    ({getClockOutLocationStatus(detailRecord).areaName})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <span className="text-surface-400">GPS</span>
                                    <p className="font-mono text-xs">
                                        {detailRecord.clockOutLat != null
                                            ? `${detailRecord.clockOutLat}, ${detailRecord.clockOutLng}`
                                            : '—'}
                                    </p>
                                </div>
                                {detailRecord.clockOutPhotoUrl && (
                                    <div className="col-span-2">
                                        <span className="text-surface-400">Selfie</span>
                                        <a href={`${import.meta.env.VITE_API_BASE_URL}${detailRecord.clockOutPhotoUrl}`} target="_blank" rel="noopener noreferrer">
                                            <img
                                                src={`${import.meta.env.VITE_API_BASE_URL}${detailRecord.clockOutPhotoUrl}`}
                                                alt="Clock-out selfie"
                                                className="mt-1 rounded-lg border border-surface-200 max-h-48 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                            />
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Working Duration */}
                        {detailRecord.workingMinutes != null && (
                            <div className="border-t border-surface-100 pt-4">
                                <span className="text-surface-400">Working Duration</span>
                                <p className="font-medium">{Math.floor(detailRecord.workingMinutes / 60)}h {detailRecord.workingMinutes % 60}m</p>
                            </div>
                        )}

                        {/* Reason */}
                        {detailRecord.reason && (
                            <div className="bg-amber-50 p-3 rounded-lg">
                                <span className="text-amber-700 font-medium text-xs">Reason</span>
                                <p className="text-amber-800 mt-0.5">{detailRecord.reason}</p>
                            </div>
                        )}
                        {detailRecord.documentUrl && (
                            <div>
                                <span className="text-surface-400 text-xs">Attachment</span>
                                <div className="mt-1">
                                    <img
                                        src={`${import.meta.env.VITE_API_BASE_URL}${detailRecord.documentUrl}`}
                                        alt="Attached document"
                                        className="rounded-lg max-h-48 object-contain border border-surface-200"
                                        onError={(e) => {
                                            const el = e.currentTarget;
                                            el.style.display = 'none';
                                            const link = el.nextElementSibling as HTMLElement;
                                            if (link) link.style.display = 'inline-flex';
                                        }}
                                    />
                                    <a
                                        href={`${import.meta.env.VITE_API_BASE_URL}${detailRecord.documentUrl}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary-600 hover:underline items-center gap-1"
                                        style={{ display: 'none' }}
                                    >
                                        <FileText size={14} className="inline mr-1" />
                                        View document
                                    </a>
                                </div>
                            </div>
                        )}

                        {detailRecord.status === 'PENDING' && (
                            <div className="flex gap-3 justify-end pt-4 border-t border-surface-100">
                                <button onClick={() => { setDetailRecord(null); setApproveTarget(detailRecord); }} className="btn-success">
                                    <Check size={16} /> Approve
                                </button>
                                <button onClick={() => { setDetailRecord(null); setRejectTarget(detailRecord); }} className="btn-danger">
                                    <X size={16} /> Reject
                                </button>
                            </div>
                        )}
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

            {/* Reject modal with comment */}
            <Modal
                open={!!rejectTarget}
                onClose={() => { setRejectTarget(null); setRejectComment(''); }}
                title="Reject Attendance"
                maxWidth="max-w-md"
            >
                <div className="space-y-4">
                    <p className="text-sm text-surface-600">
                        Reject <strong>{rejectTarget?.userName}</strong>'s {rejectTarget?.clockInType?.toLowerCase()} attendance for {rejectTarget ? formatDate(rejectTarget.attendanceDate) : ''}?
                    </p>
                    <div>
                        <label className="label">Comment (optional)</label>
                        <textarea
                            className="input w-full"
                            rows={3}
                            placeholder="Reason for rejection..."
                            value={rejectComment}
                            onChange={(e) => setRejectComment(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-3 justify-end pt-2">
                        <button
                            onClick={() => { setRejectTarget(null); setRejectComment(''); }}
                            className="btn-secondary"
                            disabled={processing}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleReject}
                            className="btn-danger"
                            disabled={processing}
                        >
                            {processing ? 'Processing...' : 'Reject'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Single Point Map Modal */}
            <SinglePointMapModal
                open={!!mapModalData}
                onClose={() => setMapModalData(null)}
                latitude={mapModalData?.lat || 0}
                longitude={mapModalData?.lng || 0}
                title={mapModalData?.title || ''}
                time={mapModalData?.time || null}
                status={mapModalData?.status || null}
                locationStatus={mapModalData?.locationStatus ?? null}
                officeAreas={officeAreas}
            />

            {/* GPS History Modal */}
            <GpsHistoryModal
                open={!!gpsHistoryUser}
                onClose={() => setGpsHistoryUser(null)}
                userId={gpsHistoryUser?.id || 0}
                userName={gpsHistoryUser?.name || ''}
            />
        </div>
    );
}
