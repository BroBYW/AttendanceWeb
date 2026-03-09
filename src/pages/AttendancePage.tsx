import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Search, Eye, Filter, X, Map, MessageCircle, FileText } from 'lucide-react';
import { attendanceService, type AttendanceFilters } from '../services/attendanceService';
import { officeAreaService } from '../services/officeAreaService';
import { userService } from '../services/userService';
import type { AttendanceResponse, AttendanceStatus, OfficeAreaResponse } from '../types';
import type { LocationStatusType } from '../components/ui/SinglePointMapModal';
import StatusBadge from '../components/ui/StatusBadge';
import Pagination from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import GpsHistoryModal from '../components/ui/GpsHistoryModal';
import SinglePointMapModal from '../components/ui/SinglePointMapModal';
import { PageLoader } from '../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

export default function AttendancePage() {
    type AttendanceBehaviorFilter = '' | 'LATE_CLOCK_IN' | 'EARLY_CLOCK_OUT' | 'OUTSTATION' | 'OUTSIDE_WORKING_AREA';
    const PAGE_SIZE = 20;
    const [records, setRecords] = useState<AttendanceResponse[]>([]);
    const [officeAreas, setOfficeAreas] = useState<OfficeAreaResponse[]>([]);
    // Map of userId -> assignedOfficeAreaIds for user-aware location status
    const [userAssignments, setUserAssignments] = useState<Record<number, number[]>>({});
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [detailRecord, setDetailRecord] = useState<AttendanceResponse | null>(null);
    const [gpsHistoryUser, setGpsHistoryUser] = useState<{ id: number, name: string } | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const [mapModalData, setMapModalData] = useState<{
        lat: number;
        lng: number;
        title: string;
        time: string | null;
        status: string | null;
        locationStatus: LocationStatusType | null;
    } | null>(null);

    // Filters
    const [filterStatus, setFilterStatus] = useState<AttendanceStatus | ''>('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [filterEmployeeId, setFilterEmployeeId] = useState('');
    const [filterAttendanceBehavior, setFilterAttendanceBehavior] = useState<AttendanceBehaviorFilter>('');

    useEffect(() => {
        loadRecords();
        if (officeAreas.length === 0) {
            loadOfficeAreas();
        }
    }, [page]);

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
            const filters: AttendanceFilters = {};
            if (filterStatus) filters.status = filterStatus;
            if (filterStartDate) filters.startDate = filterStartDate;
            if (filterEndDate) filters.endDate = filterEndDate;
            if (filterEmployeeId.trim()) {
                const keyword = filterEmployeeId.trim().toLowerCase();
                const userRes = await userService.getAll();
                if (!userRes.success) {
                    toast.error('Failed to load users for Employee ID filter');
                    setRecords([]);
                    setTotalPages(0);
                    return;
                }
                const exactMatch = userRes.data.find((u) => u.employeeId.toLowerCase() === keyword);
                const partialMatches = userRes.data.filter((u) => u.employeeId.toLowerCase().includes(keyword));
                const matchedUser = exactMatch ?? (partialMatches.length === 1 ? partialMatches[0] : null);

                if (!matchedUser) {
                    setRecords([]);
                    setTotalPages(0);
                    return;
                }
                filters.userId = matchedUser.id;
            }

            if (filterAttendanceBehavior) {
                const firstRes = await attendanceService.getAll({ ...filters, page: 0, size: 100 });
                if (!firstRes.success) {
                    setRecords([]);
                    setTotalPages(0);
                    return;
                }

                const allRecords = [...firstRes.data.content];
                for (let nextPage = 1; nextPage < firstRes.data.totalPages; nextPage++) {
                    const nextRes = await attendanceService.getAll({ ...filters, page: nextPage, size: 100 });
                    if (nextRes.success) {
                        allRecords.push(...nextRes.data.content);
                    }
                }

                const behaviorFiltered = allRecords.filter((record) => {
                    if (filterAttendanceBehavior === 'LATE_CLOCK_IN') return record.clockInType === 'LATE';
                    if (filterAttendanceBehavior === 'EARLY_CLOCK_OUT') return record.clockOutType === 'EARLY';
                    if (filterAttendanceBehavior === 'OUTSTATION') {
                        return getClockInLocationStatus(record).status === 'Outstation'
                            || getClockOutLocationStatus(record).status === 'Outstation';
                    }
                    if (filterAttendanceBehavior === 'OUTSIDE_WORKING_AREA') {
                        return getClockInLocationStatus(record).status === 'Outside Working Area'
                            || getClockOutLocationStatus(record).status === 'Outside Working Area';
                    }
                    return true;
                });

                const computedTotalPages = Math.ceil(behaviorFiltered.length / PAGE_SIZE);
                const safePage = computedTotalPages > 0 ? Math.min(page, computedTotalPages - 1) : 0;
                const startIndex = safePage * PAGE_SIZE;
                const pageContent = behaviorFiltered.slice(startIndex, startIndex + PAGE_SIZE);

                setRecords(pageContent);
                setTotalPages(computedTotalPages);
                if (safePage !== page) {
                    setPage(safePage);
                }
                return;
            }

            const res = await attendanceService.getAll({ ...filters, page, size: PAGE_SIZE });
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
        if (page === 0) {
            loadRecords();
        }
    };

    const clearFilters = () => {
        setFilterStatus('');
        setFilterStartDate('');
        setFilterEndDate('');
        setFilterEmployeeId('');
        setFilterAttendanceBehavior('');
        setPage(0);
        if (page === 0) {
            loadRecords();
        }
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
        // If frontend polygon data is available, use 3-tier user-aware logic
        if (polygonRingsWithArea.length > 0 && r.clockInLat != null && r.clockInLng != null) {
            return determineLocationStatus(r.clockInLat, r.clockInLng, r.userId);
        }
        // Fallback to backend value
        if (r.clockInType === 'OUTSTATION') return { status: 'Outstation', areaName: r.officeAreaName || undefined };
        if (r.inGeofence === false) return { status: 'Outside Working Area' };
        return { status: 'Normal', areaName: r.officeAreaName || undefined };
    };

    /** Derive location status for clock-out using user-aware polygon check */
    const getClockOutLocationStatus = (r: AttendanceResponse): { status: LocationStatusType, areaName?: string } => {
        // If frontend polygon data is available, use 3-tier user-aware logic
        if (polygonRingsWithArea.length > 0 && r.clockOutLat != null && r.clockOutLng != null) {
            return determineLocationStatus(r.clockOutLat, r.clockOutLng, r.userId);
        }
        // Fallback to backend value
        if (r.clockOutInGeofence === false) return { status: 'Outside Working Area' };
        return { status: 'Normal', areaName: r.officeAreaName || undefined };
    };

    const filteredRecords = records;

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
                            <label className="label">Employee ID</label>
                            <input
                                type="text"
                                className="input"
                                value={filterEmployeeId}
                                onChange={(e) => setFilterEmployeeId(e.target.value)}
                                placeholder="e.g. EMP001"
                            />
                        </div>
                        <div>
                            <label className="label">Attendance Behavior</label>
                            <select
                                className="select"
                                value={filterAttendanceBehavior}
                                onChange={(e) => setFilterAttendanceBehavior(e.target.value as AttendanceBehaviorFilter)}
                            >
                                <option value="">All</option>
                                <option value="LATE_CLOCK_IN">Late Clock In</option>
                                <option value="EARLY_CLOCK_OUT">Early Clock Out</option>
                                <option value="OUTSTATION">Outstation</option>
                                <option value="OUTSIDE_WORKING_AREA">Outside Working Area</option>
                            </select>
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
                            <th>Clock Out</th>
                            <th>Duration</th>
                            <th>Status</th>
                            <th className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredRecords.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="text-center py-8 text-surface-400">
                                    No attendance records found
                                </td>
                            </tr>
                        ) : (
                            filteredRecords.map((r) => (
                                <React.Fragment key={r.id}>
                                    <tr>
                                        <td className="whitespace-nowrap">{formatDate(r.attendanceDate)}</td>
                                        <td>
                                            <div>
                                                <p className="font-medium text-surface-900">{r.userName}</p>
                                                <p className="text-xs text-surface-400">{r.employeeId}</p>
                                            </div>
                                        </td>
                                        <td className="font-mono text-xs">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span>{formatTime(r.clockInTime)}</span>
                                                {r.clockInType && <StatusBadge status={r.clockInType} />}
                                            </div>
                                            <div className="mt-1 flex flex-col">
                                                <span
                                                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium w-fit ${getClockInLocationStatus(r).status === 'Normal'
                                                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                                                        : getClockInLocationStatus(r).status === 'Outstation'
                                                            ? 'bg-primary-100 text-primary-700'
                                                            : 'bg-amber-100 text-amber-700'
                                                        }`}
                                                >
                                                    {getClockInLocationStatus(r).status}
                                                </span>
                                                {getClockInLocationStatus(r).areaName && (
                                                    <span className="text-[10px] text-surface-500 mt-0.5">
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
                                                    className="text-[10px] text-primary-600 hover:text-primary-800 hover:underline flex items-center mt-1"
                                                >
                                                    <Map size={10} className="mr-0.5" /> View Map
                                                </button>
                                            )}
                                        </td>
                                        <td className="font-mono text-xs">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span>{formatTime(r.clockOutTime)}</span>
                                                {r.clockOutType && <StatusBadge status={r.clockOutType} />}
                                            </div>
                                            <div className="mt-1 flex flex-col">
                                                <span
                                                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium w-fit ${getClockOutLocationStatus(r).status === 'Normal'
                                                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                                                        : getClockOutLocationStatus(r).status === 'Outstation'
                                                            ? 'bg-primary-100 text-primary-700'
                                                            : 'bg-amber-100 text-amber-700'
                                                        }`}
                                                >
                                                    {getClockOutLocationStatus(r).status}
                                                </span>
                                                {getClockOutLocationStatus(r).areaName && (
                                                    <span className="text-[10px] text-surface-500 mt-0.5">
                                                        ({getClockOutLocationStatus(r).areaName})
                                                    </span>
                                                )}
                                            </div>
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
                                                    className="text-[10px] text-primary-600 hover:text-primary-800 hover:underline flex items-center mt-1"
                                                >
                                                    <Map size={10} className="mr-0.5" /> View Map
                                                </button>
                                            )}
                                        </td>
                                        <td>
                                            {r.workingMinutes != null
                                                ? `${Math.floor(r.workingMinutes / 60)}h ${r.workingMinutes % 60}m`
                                                : '—'}
                                        </td>
                                        <td><StatusBadge status={r.status} /></td>
                                        <td className="text-right flex justify-end gap-1">
                                            <button
                                                onClick={() => setGpsHistoryUser({ id: r.userId, name: r.userName })}
                                                className="btn-ghost btn-sm text-primary-600 p-1.5 hover:bg-primary-50"
                                                title="View GPS History"
                                            >
                                                <Map size={16} />
                                            </button>
                                            <button
                                                onClick={() => setDetailRecord(r)}
                                                className="btn-ghost btn-sm p-1.5"
                                                title="View Details"
                                            >
                                                <Eye size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                    {/* Rejection note inline row */}
                                    {r.status === 'REJECTED' && r.notes && (
                                        <tr className="bg-red-50 border-none">
                                            <td colSpan={7} className="py-2 px-4">
                                                <div className="flex items-start gap-2 text-xs">
                                                    <MessageCircle size={13} className="text-red-400 mt-0.5 shrink-0" />
                                                    <div>
                                                        <span className="font-medium text-red-600">Rejection Note: </span>
                                                        <span className="text-red-700">{r.notes}</span>
                                                        {r.reviewedByName && (
                                                            <span className="text-red-400 ml-2">— {r.reviewedByName}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
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
                                <div className="flex items-center gap-2 mt-0.5">
                                    <p className="font-medium text-surface-900">{detailRecord.userName}</p>
                                    <button
                                        onClick={() => setGpsHistoryUser({ id: detailRecord.userId, name: detailRecord.userName })}
                                        className="btn-ghost text-primary-600 p-1 hover:bg-primary-50 rounded"
                                        title="View GPS History"
                                    >
                                        <Map size={14} />
                                    </button>
                                </div>
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
                                    <div className="mt-0.5 flex flex-col gap-1">
                                        {detailRecord.clockInType ? <StatusBadge status={detailRecord.clockInType} /> : '—'}
                                        <div className="flex flex-col">
                                            <span
                                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium w-fit ${getClockInLocationStatus(detailRecord).status === 'Normal'
                                                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
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
                                </div>
                                <div>
                                    <span className="text-surface-400">GPS</span>
                                    <p className="font-mono text-xs">
                                        {detailRecord.clockInLat != null
                                            ? `${detailRecord.clockInLat}, ${detailRecord.clockInLng}`
                                            : '—'}
                                    </p>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-surface-400">Photo</span>
                                    {detailRecord.clockInPhotoUrl ? (
                                        <a
                                            href={`${import.meta.env.VITE_API_BASE_URL}${detailRecord.clockInPhotoUrl}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <img
                                                src={`${import.meta.env.VITE_API_BASE_URL}${detailRecord.clockInPhotoUrl}`}
                                                alt="Clock-in selfie"
                                                className="mt-1 rounded-lg border border-surface-200 max-h-48 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                            />
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
                                    <div className="mt-0.5 flex flex-col gap-1">
                                        {detailRecord.clockOutType ? <StatusBadge status={detailRecord.clockOutType} /> : '—'}
                                        {detailRecord.clockOutTime && (
                                            <div className="flex flex-col">
                                                <span
                                                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium w-fit ${getClockOutLocationStatus(detailRecord).status === 'Normal'
                                                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
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
                                        )}
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
                                <div className="col-span-2">
                                    <span className="text-surface-400">Photo</span>
                                    {detailRecord.clockOutPhotoUrl ? (
                                        <a
                                            href={`${import.meta.env.VITE_API_BASE_URL}${detailRecord.clockOutPhotoUrl}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <img
                                                src={`${import.meta.env.VITE_API_BASE_URL}${detailRecord.clockOutPhotoUrl}`}
                                                alt="Clock-out selfie"
                                                className="mt-1 rounded-lg border border-surface-200 max-h-48 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                            />
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
                                            <span className="text-surface-400">Attachment</span>
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
                                </div>
                            </>
                        )}
                        {/* Rejection Note (prominent) */}
                        {detailRecord.status === 'REJECTED' && detailRecord.notes && (
                            <>
                                <hr className="border-surface-100" />
                                <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <MessageCircle size={14} className="text-red-500" />
                                        <span className="text-red-700 font-semibold text-xs">Rejection Note</span>
                                    </div>
                                    <p className="text-red-700 text-sm">{detailRecord.notes}</p>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </Modal>

            {/* GPS History modal */}
            {gpsHistoryUser && (
                <GpsHistoryModal
                    open={!!gpsHistoryUser}
                    onClose={() => setGpsHistoryUser(null)}
                    userId={gpsHistoryUser.id}
                    userName={gpsHistoryUser.name}
                />
            )}

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
        </div>
    );
}
