import { useEffect, useState, useMemo } from 'react';
import Modal from './Modal';
import type { GpsLogResponse, OfficeAreaResponse } from '../../types';
import { getUserGpsLogs } from '../../services/gpsLogService';
import { officeAreaService } from '../../services/officeAreaService';
import { PageLoader } from './LoadingSpinner';
import toast from 'react-hot-toast';
import { MapPin, Map, List, RefreshCw } from 'lucide-react';
import GpsMap from './GpsMap';

/**
 * Ray-casting point-in-polygon test.
 * ring is an array of [lng, lat] pairs (GeoJSON order).
 */
function pointInPolygon(lat: number, lng: number, ring: number[][]): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][1], yi = ring[i][0];
        const xj = ring[j][1], yj = ring[j][0];
        const intersect = ((yi > lng) !== (yj > lng)) &&
            (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

/**
 * Find the containing GeoJSON block for a point.
 */
function findContainingBlock(
    lat: number, lng: number,
    polygonRings: { estate: string; division: number; blockno: number; taskno: number; ring: number[][] }[]
): string | null {
    for (const p of polygonRings) {
        if (pointInPolygon(lat, lng, p.ring)) {
            const parts: string[] = [];
            if (p.estate) parts.push(p.estate);
            if (p.division) parts.push(`D${p.division}`);
            if (p.blockno) parts.push(`B${p.blockno}`);
            if (p.taskno) parts.push(`T${p.taskno}`);
            return parts.join(' · ') || 'Unknown';
        }
    }
    return null;
}

/**
 * Find the containing KML polygon name for a point.
 * KML coordinates are stored as [lat, lng] (Leaflet order).
 */
function findContainingKml(
    lat: number, lng: number,
    kmlPolygons: { name: string; coordinates: [number, number][] }[]
): string | null {
    for (const p of kmlPolygons) {
        // Convert [lat, lng] to [lng, lat] ring for pointInPolygon
        const ring = p.coordinates.map(c => [c[1], c[0]]);
        if (pointInPolygon(lat, lng, ring)) {
            return p.name;
        }
    }
    return null;
}

interface Props {
    open: boolean;
    onClose: () => void;
    userId: number;
    userName: string;
}

export default function GpsHistoryModal({ open, onClose, userId, userName }: Props) {
    const [logs, setLogs] = useState<GpsLogResponse[]>([]);
    const [officeAreas, setOfficeAreas] = useState<OfficeAreaResponse[]>([]);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'map' | 'table' | 'split'>('split');
    const [selectedLogId, setSelectedLogId] = useState<number | null>(null);

    useEffect(() => {
        if (open && userId) {
            fetchLogs();
            setSelectedLogId(null); // Reset selection
        } else {
            setLogs([]); // Reset on close
            setSelectedLogId(null);
        }
    }, [open, userId]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const [logsData, areasData] = await Promise.all([
                getUserGpsLogs(userId),
                officeAreaService.getAll()
            ]);
            setLogs(logsData);
            if (areasData.success) {
                const activeAreas = areasData.data.filter((a: OfficeAreaResponse) => a.status === 'ACTIVE');
                setOfficeAreas(activeAreas);
                // Background-load geojson data for polygon overlays
                const needsGeojson = activeAreas.some(a => !a.geojsonData);
                if (needsGeojson) {
                    officeAreaService.getGeojsonMap().then(geoRes => {
                        if (geoRes.success && geoRes.data) {
                            setOfficeAreas(prev => prev.map(area => ({
                                ...area,
                                geojsonData: (geoRes.data as any)[area.id] ?? area.geojsonData ?? null,
                            })));
                        }
                    }).catch(() => {});
                }
            }
        } catch (error) {
            toast.error('Failed to load GPS history or areas');
        } finally {
            setLoading(false);
        }
    };

    // Extract GeoJSON polygon rings for point-in-polygon checks
    const polygonRings = useMemo(() => {
        const rings: { estate: string; division: number; blockno: number; taskno: number; ring: number[][] }[] = [];
        for (const area of officeAreas) {
            if (area.geojsonData) {
                try {
                    const parsed = (typeof area.geojsonData === 'string' 
                        ? JSON.parse(area.geojsonData) 
                        : area.geojsonData) as GeoJSON.FeatureCollection;
                        
                    if (parsed.features) {
                        for (const feature of parsed.features) {
                            const props = feature.properties || {};
                            const estate = String(props.Estate || '');
                            const division = Number(props.Division || 0);
                            const blockno = Number(props.Blockno || 0);
                            const taskno = Number(props.TaskNo ?? props.Taskno ?? 0);
                            const geom = feature.geometry;
                            if (geom.type === 'Polygon') {
                                rings.push({ estate, division, blockno, taskno, ring: (geom as any).coordinates[0] });
                            } else if (geom.type === 'MultiPolygon') {
                                for (const poly of (geom as any).coordinates) {
                                    rings.push({ estate, division, blockno, taskno, ring: poly[0] });
                                }
                            }
                        }
                    }
                } catch { /* skip */ }
            }
        }
        return rings;
    }, [officeAreas]);

    // Fetch and parse KML polygons
    const [kmlPolygons, setKmlPolygons] = useState<{ name: string; coordinates: [number, number][] }[]>([]);
    useEffect(() => {
        const fetchKml = async () => {
            const promises = officeAreas.map(async (area) => {
                if (area.polygonFileUrl && !area.geojsonData) {
                    try {
                        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}${area.polygonFileUrl}`);
                        if (!res.ok) return null;
                        const kmlText = await res.text();
                        const parser = new DOMParser();
                        const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
                        const coordsNode = xmlDoc.getElementsByTagName('coordinates')[0];
                        if (coordsNode?.textContent) {
                            const coords: [number, number][] = [];
                            for (const c of coordsNode.textContent.trim().split(/\s+/)) {
                                const parts = c.split(',');
                                if (parts.length >= 2) {
                                    const lng = parseFloat(parts[0]);
                                    const lat = parseFloat(parts[1]);
                                    if (!isNaN(lat) && !isNaN(lng)) coords.push([lat, lng]);
                                }
                            }
                            if (coords.length > 0) return { name: area.name, coordinates: coords };
                        }
                    } catch { /* skip */ }
                }
                return null;
            });
            
            const results = await Promise.all(promises);
            setKmlPolygons(results.filter((r): r is { name: string; coordinates: [number, number][] } => r !== null));
        };
        fetchKml();
    }, [officeAreas]);

    /** Build the polygon detail string for a given point */
    const getPolygonDetail = (lat: number, lng: number): string | null => {
        // Check GeoJSON blocks first
        const blockInfo = polygonRings.length > 0
            ? findContainingBlock(lat, lng, polygonRings)
            : null;
        if (blockInfo) return blockInfo;
        // Check KML polygons
        const kmlInfo = kmlPolygons.length > 0
            ? findContainingKml(lat, lng, kmlPolygons)
            : null;
        return kmlInfo;
    };

    const getStatusStyles = (status: string | null) => {
        switch (status) {
            case 'NORMAL':
                return 'bg-success-100 text-success-700 border-success-200';
            case 'OUTSTATION':
                return 'bg-warning-100 text-warning-700 border-warning-200';
            case 'OUTSIDE':
                return 'bg-danger-100 text-danger-700 border-danger-200';
            default:
                return 'bg-surface-100 text-surface-600 border-surface-200';
        }
    };

    const getStatusLabel = (status: string | null): string => {
        switch (status) {
            case 'NORMAL': return '✓ Normal';
            case 'OUTSTATION': return '⚠ Outstation';
            case 'OUTSIDE': return '✗ Outside';
            default: return status || 'UNKNOWN';
        }
    };

    const handleLogClick = (log: GpsLogResponse) => {
        setSelectedLogId(log.id);
        if (viewMode === 'table') {
            setViewMode('split');
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={`GPS History: ${userName}`}
            maxWidth="max-w-6xl"
        >
            <div className="flex flex-col h-[85vh]">
                <div className="flex items-center justify-end gap-2 mb-4">
                    <button
                        onClick={fetchLogs}
                        disabled={loading}
                        className="btn-sm btn-secondary mr-auto flex items-center gap-1.5"
                        title="Refresh GPS logs"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                    <span className="text-sm text-surface-500 font-medium mr-2">View:</span>
                    <button
                        onClick={() => setViewMode('map')}
                        className={`btn-sm ${viewMode === 'map' ? 'bg-primary-100 text-primary-700' : 'btn-ghost'}`}
                    >
                        <Map size={16} /> Map
                    </button>
                    <button
                        onClick={() => setViewMode('table')}
                        className={`btn-sm ${viewMode === 'table' ? 'bg-primary-100 text-primary-700' : 'btn-ghost'}`}
                    >
                        <List size={16} /> Table
                    </button>
                    <button
                        onClick={() => setViewMode('split')}
                        className={`btn-sm ${viewMode === 'split' ? 'bg-primary-100 text-primary-700' : 'btn-ghost'}`}
                    >
                        Split
                    </button>
                </div>

                {loading ? (
                    <div className="flex-1 flex justify-center items-center">
                        <PageLoader />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex-1 flex flex-col justify-center items-center text-surface-400 gap-4">
                        <MapPin size={48} className="text-surface-300" />
                        <p>No GPS logs found for this user.</p>
                    </div>
                ) : (
                    <div className={`flex-1 flex gap-4 min-h-0 ${viewMode === 'split' ? 'flex-col md:flex-row' : 'flex-col'}`}>
                        {/* MAP VIEW */}
                        {(viewMode === 'map' || viewMode === 'split') && (
                            <div className={`flex flex-col bg-surface-50 rounded-lg border border-surface-200 overflow-hidden ${viewMode === 'split' ? 'md:w-1/2' : 'w-full'}`}>
                                <div className="p-3 border-b border-surface-200 bg-white font-medium text-surface-700 text-sm flex justify-between items-center">
                                    <span>Movement Trace</span>
                                    <span className="text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">{logs.length} Points</span>
                                </div>
                                <div className="flex-1 relative z-0 min-h-[300px]">
                                    <GpsMap logs={logs} officeAreas={officeAreas} selectedLogId={selectedLogId} />
                                </div>
                            </div>
                        )}

                        {/* TABLE VIEW */}
                        {(viewMode === 'table' || viewMode === 'split') && (
                            <div className={`flex flex-col rounded-lg border border-surface-200 overflow-hidden ${viewMode === 'split' ? 'md:w-1/2' : 'w-full'}`}>
                                <div className="p-3 border-b border-surface-200 bg-white font-medium text-surface-700 text-sm">
                                    Chronological Logs
                                </div>
                                <div className="flex-1 overflow-auto">
                                    <table className="w-full text-left text-sm whitespace-nowrap">
                                        <thead className="bg-surface-50 sticky top-0 border-b border-surface-200 z-10 shadow-sm">
                                            <tr>
                                                <th className="px-4 py-3 font-medium text-surface-600">Time</th>
                                                <th className="px-4 py-3 font-medium text-surface-600">Location</th>
                                                <th className="px-4 py-3 font-medium text-surface-600">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-surface-100 bg-white">
                                            {logs.map((log) => {
                                                const polyDetail = getPolygonDetail(log.latitude, log.longitude);
                                                const isSelected = selectedLogId === log.id;
                                                return (
                                                    <tr
                                                        key={log.id}
                                                        onClick={() => handleLogClick(log)}
                                                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary-50 ring-1 ring-inset ring-primary-500' : 'hover:bg-primary-50'}`}
                                                    >
                                                        <td className="px-4 py-3">
                                                            <div className="font-semibold text-surface-900">
                                                                {new Date(log.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                                            </div>
                                                            <div className="text-xs text-surface-500 mt-0.5">
                                                                {new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="font-mono text-[11px] text-surface-600 bg-surface-100 inline-block px-1.5 py-0.5 rounded">
                                                                {log.latitude.toFixed(6)}, {log.longitude.toFixed(6)}
                                                            </div>
                                                            {log.accuracy && (
                                                                <div className="text-[10px] text-surface-400 mt-1">
                                                                    Accuracy ±{log.accuracy.toFixed(0)}m
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${getStatusStyles(log.areaStatus)}`}>
                                                                {getStatusLabel(log.areaStatus)}
                                                            </span>
                                                            {polyDetail && (
                                                                <div className="text-[10px] text-success-700 mt-1 font-medium">
                                                                    ({polyDetail})
                                                                </div>
                                                            )}
                                                            {log.remark && (
                                                                <div className="text-[11px] text-primary-700 mt-2 font-medium italic bg-primary-50 px-1.5 py-0.5 rounded border border-primary-200 w-max max-w-[200px] truncate whitespace-normal leading-tight" title={log.remark}>
                                                                    Note: {log.remark}
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex justify-end pt-4 mt-auto border-t border-surface-100">
                    <button onClick={onClose} className="btn-secondary">
                        Close
                    </button>
                </div>
            </div>
        </Modal>
    );
}
