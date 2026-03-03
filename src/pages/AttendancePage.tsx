import { useEffect, useState, useMemo } from 'react';
import { Search, Eye, Filter, X, Map } from 'lucide-react';
import { attendanceService, type AttendanceFilters } from '../services/attendanceService';
import { officeAreaService } from '../services/officeAreaService';
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
    const [records, setRecords] = useState<AttendanceResponse[]>([]);
    const [officeAreas, setOfficeAreas] = useState<OfficeAreaResponse[]>([]);
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
    const [filterUserId, setFilterUserId] = useState('');

    useEffect(() => {
        loadRecords();
        if (officeAreas.length === 0) {
            loadOfficeAreas();
        }
    }, [page]);

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

    /** Extract all polygon rings from office area GeoJSON data */
    const polygonRings = useMemo(() => {
        const rings: number[][][] = [];
        for (const area of officeAreas) {
            if (!area.geojsonData) continue;
            try {
                const parsed = JSON.parse(area.geojsonData);
                if (!parsed.features) continue;
                for (const feature of parsed.features) {
                    const geom = feature.geometry;
                    if (geom?.type === 'Polygon' && geom.coordinates?.[0]) {
                        rings.push(geom.coordinates[0]);
                    } else if (geom?.type === 'MultiPolygon') {
                        for (const poly of geom.coordinates) {
                            if (poly[0]) rings.push(poly[0]);
                        }
                    }
                }
            } catch { /* ignore parse errors */ }
        }
        return rings;
    }, [officeAreas]);

    /** Check if a point is inside any polygon */
    const isInsideAnyPolygon = (lat: number | null, lng: number | null): boolean => {
        if (lat == null || lng == null || polygonRings.length === 0) return false;
        return polygonRings.some(ring => pointInPolygon(lat, lng, ring));
    };

    /** Derive location status for clock-in using frontend polygon check */
    const getClockInLocationStatus = (r: AttendanceResponse): LocationStatusType => {
        if (r.clockInType === 'OUTSTATION') return 'Outstation';
        // Use frontend polygon detection (more accurate than saved backend value)
        if (polygonRings.length > 0 && r.clockInLat != null && r.clockInLng != null) {
            return isInsideAnyPolygon(r.clockInLat, r.clockInLng) ? 'Normal' : 'Outside Working Area';
        }
        // Fallback to backend value
        if (r.inGeofence === false) return 'Outside Working Area';
        return 'Normal';
    };

    /** Derive location status for clock-out using frontend polygon check */
    const getClockOutLocationStatus = (r: AttendanceResponse): LocationStatusType => {
        // Use frontend polygon detection
        if (polygonRings.length > 0 && r.clockOutLat != null && r.clockOutLng != null) {
            return isInsideAnyPolygon(r.clockOutLat, r.clockOutLng) ? 'Normal' : 'Outside Working Area';
        }
        // Fallback to backend value
        if (r.clockOutInGeofence === false) return 'Outside Working Area';
        return 'Normal';
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
                                    <td className="font-mono text-xs">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span>{formatTime(r.clockInTime)}</span>
                                            {r.clockInType && <StatusBadge status={r.clockInType} />}
                                        </div>
                                        <div className="mt-1">
                                            <span
                                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${getClockInLocationStatus(r) === 'Normal'
                                                    ? 'bg-success-100 text-success-700'
                                                    : getClockInLocationStatus(r) === 'Outstation'
                                                        ? 'bg-primary-100 text-primary-700'
                                                        : 'bg-amber-100 text-amber-700'
                                                    }`}
                                            >
                                                {getClockInLocationStatus(r)}
                                            </span>
                                        </div>
                                        {r.clockInLat && r.clockInLng && (
                                            <button
                                                onClick={() => setMapModalData({
                                                    lat: r.clockInLat!,
                                                    lng: r.clockInLng!,
                                                    title: `Clock In Location: ${r.userName}`,
                                                    time: r.clockInTime ? new Date(r.clockInTime).toLocaleTimeString() : null,
                                                    status: r.clockInType || 'UNKNOWN',
                                                    locationStatus: getClockInLocationStatus(r)
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
                                        <div className="mt-1">
                                            <span
                                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${getClockOutLocationStatus(r) === 'Normal'
                                                    ? 'bg-success-100 text-success-700'
                                                    : getClockOutLocationStatus(r) === 'Outstation'
                                                        ? 'bg-primary-100 text-primary-700'
                                                        : 'bg-amber-100 text-amber-700'
                                                    }`}
                                            >
                                                {getClockOutLocationStatus(r)}
                                            </span>
                                        </div>
                                        {r.clockOutLat && r.clockOutLng && (
                                            <button
                                                onClick={() => setMapModalData({
                                                    lat: r.clockOutLat!,
                                                    lng: r.clockOutLng!,
                                                    title: `Clock Out Location: ${r.userName}`,
                                                    time: r.clockOutTime ? new Date(r.clockOutTime).toLocaleTimeString() : null,
                                                    status: r.clockOutType || 'UNKNOWN',
                                                    locationStatus: getClockOutLocationStatus(r)
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
                                <div className="col-span-2">
                                    <span className="text-surface-400">Photo</span>
                                    {detailRecord.clockInPhotoUrl ? (
                                        <a
                                            href={`http://localhost:8080${detailRecord.clockInPhotoUrl}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <img
                                                src={`http://localhost:8080${detailRecord.clockInPhotoUrl}`}
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
                                <div className="col-span-2">
                                    <span className="text-surface-400">Photo</span>
                                    {detailRecord.clockOutPhotoUrl ? (
                                        <a
                                            href={`http://localhost:8080${detailRecord.clockOutPhotoUrl}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <img
                                                src={`http://localhost:8080${detailRecord.clockOutPhotoUrl}`}
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
