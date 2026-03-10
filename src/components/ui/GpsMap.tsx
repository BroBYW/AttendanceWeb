import { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, Polygon, GeoJSON } from 'react-leaflet';
import type { GpsLogResponse, OfficeAreaResponse } from '../../types';
import L from 'leaflet';

// Fix for default marker icons in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom icons based on status coloring
const createStatusIcon = (color: string) => {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.4);"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    });
};

const icons = {
    NORMAL: createStatusIcon('#10b981'), // success-500
    OUTSTATION: createStatusIcon('#f59e0b'), // warning-500
    OUTSIDE: createStatusIcon('#ef4444'), // danger-500
    DEFAULT: createStatusIcon('#6b7280'), // surface-500
};

// Block color palette for GeoJSON features (same as CoverageMap)
const blockColors = [
    '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4',
    '#42d4f4', '#f032e6', '#bfef45', '#fabed4', '#469990',
    '#dcbeff', '#9A6324', '#fffac8', '#800000', '#aaffc3',
    '#808000', '#ffd8b1', '#000075', '#a9a9a9', '#e6beff',
    '#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#e74c3c',
    '#f39c12', '#1f77b4',
];

/**
 * Ray-casting point-in-polygon test.
 * ring is an array of [lng, lat] pairs (GeoJSON order).
 */
function pointInPolygon(lat: number, lng: number, ring: number[][]): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][1], yi = ring[i][0]; // lat, lng
        const xj = ring[j][1], yj = ring[j][0];
        const intersect = ((yi > lng) !== (yj > lng)) &&
            (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

/**
 * Check if a point is inside any polygon.
 * Returns the block/task info string if inside, or null if outside.
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

// Component to handle map resizing dynamically when inside modals/tabs
function MapResizer() {
    const map = useMap();
    useEffect(() => {
        const observer = new ResizeObserver(() => {
            map.invalidateSize();
        });
        observer.observe(map.getContainer());
        return () => observer.disconnect();
    }, [map]);
    return null;
}

interface Props {
    logs: GpsLogResponse[];
    officeAreas: OfficeAreaResponse[];
    selectedLogId?: number | null;
}

export default function GpsMap({ logs, officeAreas, selectedLogId }: Props) {
    // If no logs, fallback to a default view (e.g. standard coords)
    const defaultCenter: [number, number] = [2.340590, 111.845049];

    // Ref to store Marker instances for opening popups
    const markerRefs = useRef<{ [id: number]: L.Marker | null }>({});

    // Sort logs chronologically to draw the path correctly
    const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Group logs by day for separate trace lines
    const traceByDay = useMemo(() => {
        const dayMap = new Map<string, [number, number][]>();
        for (const log of sortedLogs) {
            const dateKey = new Date(log.timestamp).toLocaleDateString('en-CA');
            if (!dayMap.has(dateKey)) {
                dayMap.set(dateKey, []);
            }
            dayMap.get(dateKey)!.push([log.latitude, log.longitude]);
        }
        const result: { date: string; points: [number, number][] }[] = [];
        for (const [date, points] of dayMap) {
            result.push({ date, points });
        }
        return result;
    }, [sortedLogs]);

    // Colors for different days (cycles if more than available)
    const dayColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

    // Day filter state — all days selected by default
    const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());

    // Initialize selectedDays when traceByDay changes
    // Initialize selectedDays with ONLY the latest day by default
    useEffect(() => {
        if (traceByDay.length > 0) {
            const latestDate = traceByDay[traceByDay.length - 1].date;
            setSelectedDays(new Set([latestDate]));
        }
    }, [traceByDay.length]);

    // Ensure the day of the selected log is visible
    useEffect(() => {
        if (selectedLogId) {
            const log = logs.find(l => l.id === selectedLogId);
            if (log) {
                const dateKey = new Date(log.timestamp).toLocaleDateString('en-CA');
                setSelectedDays(prev => {
                    if (!prev.has(dateKey)) {
                        return new Set([...prev, dateKey]);
                    }
                    return prev;
                });
            }
        }
    }, [selectedLogId, logs]);

    const toggleDay = (date: string) => {
        setSelectedDays(prev => {
            const next = new Set(prev);
            if (next.has(date)) {
                next.delete(date);
            } else {
                next.add(date);
            }
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedDays.size === traceByDay.length) {
            setSelectedDays(new Set());
        } else {
            setSelectedDays(new Set(traceByDay.map(d => d.date)));
        }
    };

    // Filtered data based on selected days
    const filteredLogs = sortedLogs.filter(log => {
        const dateKey = new Date(log.timestamp).toLocaleDateString('en-CA');
        return selectedDays.has(dateKey);
    });

    // All trace points for bounds calculation (from filtered data)
    const tracePoints: [number, number][] = filteredLogs.map(log => [log.latitude, log.longitude]);

    // State to hold parsed KML polygons
    const [kmlPolygons, setKmlPolygons] = useState<{ id: number; name: string; coordinates: [number, number][] }[]>([]);

    // Parse GeoJSON data from office areas
    const { geojsonLayers, polygonRings } = useMemo(() => {
        const layers: { id: number; name: string; data: GeoJSON.FeatureCollection }[] = [];
        const rings: { estate: string; division: number; blockno: number; taskno: number; ring: number[][] }[] = [];

        for (const area of officeAreas) {
            if (area.geojsonData) {
                try {
                    const parsed = (typeof area.geojsonData === 'string'
                        ? JSON.parse(area.geojsonData)
                        : area.geojsonData) as GeoJSON.FeatureCollection;
                        
                    layers.push({ id: area.id, name: area.name, data: parsed });

                    // Extract polygon rings for point-in-polygon checks
                    if (parsed.features) {
                        for (const feature of parsed.features) {
                            const props = feature.properties || {};
                            const estate = props.Estate || '';
                            const division = props.Division || 0;
                            const blockno = props.Blockno || 0;
                            const taskno = props.TaskNo ?? props.Taskno ?? 0;
                            const geom = feature.geometry;
                            if (geom.type === 'Polygon') {
                                rings.push({ estate, division, blockno, taskno, ring: geom.coordinates[0] as number[][] });
                            } else if (geom.type === 'MultiPolygon') {
                                for (const poly of geom.coordinates) {
                                    rings.push({ estate, division, blockno, taskno, ring: poly[0] as number[][] });
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error('Failed to parse GeoJSON for area ' + area.name, err);
                }
            }
        }
        return { geojsonLayers: layers, polygonRings: rings };
    }, [officeAreas]);

    useEffect(() => {
        // Fetch and parse KML for each office area that has a polygonUrl but no geojsonData
        const fetchKmlPolygons = async () => {
            const promises = officeAreas.map(async (area) => {
                if (area.polygonFileUrl && !area.geojsonData) {
                    try {
                        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}${area.polygonFileUrl}`);
                        if (!response.ok) return null;

                        const kmlText = await response.text();

                        // Parse XML
                        const parser = new DOMParser();
                        const xmlDoc = parser.parseFromString(kmlText, "text/xml");

                        // Find coordinates tag using namespace-agnostic selector
                        const coordsNode = xmlDoc.getElementsByTagName("coordinates")[0];

                        if (coordsNode && coordsNode.textContent) {
                            // Split by whitespace
                            const pointsStr = coordsNode.textContent.trim().split(/\s+/);
                            const coordinates: [number, number][] = [];

                            pointsStr.forEach(coord => {
                                // Longitude, Latitude, [Altitude]
                                const parts = coord.split(',');
                                if (parts.length >= 2) {
                                    const lng = parseFloat(parts[0]);
                                    const lat = parseFloat(parts[1]);
                                    if (!isNaN(lat) && !isNaN(lng)) {
                                        // Leaflet Polygon expects [Lat, Lng]
                                        coordinates.push([lat, lng]);
                                    }
                                }
                            });

                            if (coordinates.length > 0) {
                                return {
                                    id: area.id,
                                    name: area.name,
                                    coordinates: coordinates
                                };
                            }
                        }
                    } catch (error) {
                        console.error('Failed to fetch/parse KML for area ' + area.name, error);
                    }
                }
                return null;
            });

            const results = await Promise.all(promises);
            setKmlPolygons(results.filter((r): r is { id: number; name: string; coordinates: [number, number][] } => r !== null));
        };

        fetchKmlPolygons();
    }, [officeAreas]);

    // Collect all GeoJSON bounds for map fitting
    const geojsonBounds = useMemo(() => {
        const pts: [number, number][] = [];
        for (const layer of geojsonLayers) {
            for (const feature of layer.data.features) {
                const geom = feature.geometry;
                const extractCoords = (coords: number[][]): void => {
                    for (const c of coords) {
                        if (c.length >= 2) pts.push([c[1], c[0]]); // lat, lng
                    }
                };
                if (geom.type === 'Polygon') {
                    extractCoords(geom.coordinates[0] as number[][]);
                } else if (geom.type === 'MultiPolygon') {
                    for (const poly of geom.coordinates) {
                        extractCoords(poly[0] as number[][]);
                    }
                }
            }
        }
        return pts;
    }, [geojsonLayers]);

    // Calculate bounds if we have points or polygons
    const allTracePoints = [...tracePoints, ...kmlPolygons.flatMap(p => p.coordinates), ...geojsonBounds];
    const bounds = allTracePoints.length > 0 ? L.latLngBounds(allTracePoints) : null;

    // Also include office areas in bounds if desired, but sticking to logs is usually better to focus on the person.

    const getIconForStatus = (status: string | null) => {
        switch (status) {
            case 'NORMAL': return icons.NORMAL;
            case 'OUTSTATION': return icons.OUTSTATION;
            case 'OUTSIDE': return icons.OUTSIDE;
            default: return icons.DEFAULT;
        }
    };
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Component to control map panning and opening popups
    function MapController({ selectedId }: { selectedId?: number | null }) {
        const map = useMap();
        useEffect(() => {
            if (selectedId) {
                const log = logs.find(l => l.id === selectedId);
                if (log) {
                    map.flyTo([log.latitude, log.longitude], 18, { duration: 0.5 });

                    // Open popup after a short delay to allow flyTo to start
                    setTimeout(() => {
                        const marker = markerRefs.current[selectedId];
                        if (marker) {
                            marker.openPopup();
                        }
                    }, 500);
                }
            }
        }, [selectedId, map]);
        return null;
    }

    return (
        <div className="relative h-full w-full">
            {/* Map fills the entire area */}
            <MapContainer
                bounds={bounds || undefined}
                center={!bounds ? defaultCenter : undefined}
                zoom={!bounds ? 13 : undefined}
                style={{ height: '100%', width: '100%', minHeight: '400px' }}
                scrollWheelZoom={true}
            >
                <MapResizer />
                <MapController selectedId={selectedLogId} />
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Drawer toggle button — only shown when multiple days */}
                {traceByDay.length > 1 && (
                    <>
                        <div
                            className="leaflet-top leaflet-left"
                            style={{ top: '80px' }}
                        >
                            <div className="leaflet-control">
                                <button
                                    onClick={() => setDrawerOpen(!drawerOpen)}
                                    className="bg-white border border-surface-300 rounded-lg shadow-md px-2.5 py-2 flex items-center gap-1.5 hover:bg-surface-50 transition-colors"
                                    title="Filter days"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
                                    <span className="text-xs font-semibold text-surface-700">Days</span>
                                    <span className="text-[10px] bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full font-bold">
                                        {selectedDays.size}/{traceByDay.length}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {/* Drawer panel overlay */}
                {drawerOpen && traceByDay.length > 1 && (
                    <div
                        className="leaflet-top leaflet-left"
                        style={{ top: '120px' }}
                    >
                        <div className="leaflet-control">
                            <div className="bg-white rounded-lg shadow-lg border border-surface-200 w-[180px] overflow-hidden">
                                <div className="px-3 py-2 border-b border-surface-200 bg-surface-50 flex items-center justify-between gap-1">
                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-surface-700 whitespace-nowrap">
                                        <input
                                            type="checkbox"
                                            checked={selectedDays.size === traceByDay.length}
                                            onChange={toggleAll}
                                            className="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                                        />
                                        All
                                    </label>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => {
                                                if (traceByDay.length > 0) {
                                                    setSelectedDays(new Set([traceByDay[traceByDay.length - 1].date]));
                                                }
                                            }}
                                            className="text-[10px] bg-white border border-surface-200 px-1.5 py-0.5 rounded hover:bg-surface-50 text-surface-600 font-medium"
                                        >
                                            Latest
                                        </button>
                                        <button
                                            onClick={() => setDrawerOpen(false)}
                                            className="text-surface-400 hover:text-surface-600 text-sm leading-none p-0.5 ml-1"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                                <div className="max-h-[350px] overflow-y-auto">
                                    {(() => {
                                        const months: { month: string, days: typeof traceByDay }[] = [];
                                        traceByDay.forEach(day => {
                                            const monthName = new Date(day.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
                                            const lastMonth = months[months.length - 1];
                                            if (lastMonth && lastMonth.month === monthName) {
                                                lastMonth.days.push(day);
                                            } else {
                                                months.push({ month: monthName, days: [day] });
                                            }
                                        });

                                        return months.reverse().map(m => (
                                            <div key={m.month}>
                                                <div className="px-3 py-1 bg-surface-50 text-[10px] font-bold text-surface-500 uppercase tracking-wider border-y border-surface-100 sticky top-0 z-10">
                                                    {m.month}
                                                </div>
                                                <div className="divide-y divide-surface-100">
                                                    {m.days.reverse().map((day) => {
                                                        const idx = traceByDay.findIndex(d => d.date === day.date);
                                                        const color = dayColors[idx % dayColors.length];
                                                        const isActive = selectedDays.has(day.date);
                                                        const label = new Date(day.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                                                        return (
                                                            <label
                                                                key={day.date}
                                                                className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors text-xs ${isActive ? 'bg-white' : 'bg-surface-50 opacity-60'
                                                                    } hover:bg-surface-100`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isActive}
                                                                    onChange={() => toggleDay(day.date)}
                                                                    className="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                                                                />
                                                                <span
                                                                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                                                                    style={{ backgroundColor: color }}
                                                                />
                                                                <span className="flex flex-col leading-tight">
                                                                    <span className="font-medium text-surface-800">{label}</span>
                                                                    <span className="text-[10px] text-surface-500">{day.points.length} pts</span>
                                                                </span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Draw active office areas (Circles) only if no Polygon exists */}
                {officeAreas.map(area => {
                    if (area.radiusMeters && area.latitude && area.longitude && !area.polygonFileUrl) {
                        return (
                            <Circle
                                key={area.id}
                                center={[area.latitude, area.longitude]}
                                radius={area.radiusMeters}
                                pathOptions={{ color: '#0ea5e9', fillColor: '#0ea5e9', fillOpacity: 0.2 }}
                            >
                                <Popup>{area.name}</Popup>
                            </Circle>
                        );
                    }
                    return null;
                })}

                {/* Draw active office areas (Polygons from KML) */}
                {kmlPolygons.map(polygon => (
                    <Polygon
                        key={`poly-${polygon.id}`}
                        positions={polygon.coordinates}
                        pathOptions={{ color: '#ec4899', fillColor: '#ec4899', fillOpacity: 0.2, weight: 2 }}
                    >
                        <Popup>{polygon.name} (Polygon Area)</Popup>
                    </Polygon>
                ))}

                {/* Draw GeoJSON polygons with block colors */}
                {geojsonLayers.map(layer => (
                    <GeoJSON
                        key={`geojson-${layer.id}`}
                        data={layer.data}
                        style={(feature) => {
                            if (!feature?.properties?.Blockno) {
                                return { color: '#3b82f6', weight: 2, fillOpacity: 0.15 };
                            }
                            const blockno = Number(feature.properties.Blockno);
                            const colorIndex = (blockno - 1) % blockColors.length;
                            const color = blockColors[colorIndex >= 0 ? colorIndex : 0];
                            return { color, weight: 2.5, opacity: 0.9, fillColor: color, fillOpacity: 0.15 };
                        }}
                        onEachFeature={(feature, featureLayer) => {
                            if (feature.properties) {
                                const props = feature.properties;
                                const taskNo = props.TaskNo ?? props.Taskno;
                                const parts: string[] = [];
                                if (props.Estate) parts.push(`Estate: ${props.Estate}`);
                                if (props.Division != null) parts.push(`Div ${props.Division}`);
                                if (props.Blockno) parts.push(`Block ${props.Blockno}`);
                                if (taskNo) parts.push(`Task ${taskNo}`);
                                if (props.AreaHa) parts.push(`${props.AreaHa} ha`);
                                if (parts.length > 0) {
                                    featureLayer.bindTooltip(parts.join(' · '), { sticky: true });
                                }
                            }
                        }}
                    />
                ))}

                {/* Draw the movement trace line — one per day */}
                {traceByDay.map((day, idx) => {
                    if (!selectedDays.has(day.date)) return null;
                    return (
                        <Polyline
                            key={`trace-${day.date}`}
                            positions={day.points}
                            pathOptions={{
                                color: dayColors[idx % dayColors.length],
                                weight: 3,
                                dashArray: '5, 10'
                            }}
                        >
                            <Popup>{day.date}</Popup>
                        </Polyline>
                    );
                })}

                {/* Plot each log point (only for selected days) */}
                {filteredLogs.map(log => {
                    const blockInfo = polygonRings.length > 0
                        ? findContainingBlock(log.latitude, log.longitude, polygonRings)
                        : null;
                    return (
                        <Marker
                            key={log.id}
                            position={[log.latitude, log.longitude]}
                            icon={getIconForStatus(log.areaStatus)}
                            ref={(el) => { markerRefs.current[log.id] = el; }}
                        >
                            <Popup>
                                <div className="text-xs">
                                    <strong>Date:</strong> {new Date(log.timestamp).toLocaleDateString()}<br />
                                    <strong>Time:</strong> {new Date(log.timestamp).toLocaleTimeString()}<br />
                                    <strong>Status:</strong> {log.areaStatus}<br />
                                    {log.accuracy && <><strong>Accuracy:</strong> ±{log.accuracy.toFixed(0)}m<br /></>}
                                    {polygonRings.length > 0 && (
                                        <>
                                            <strong>Polygon:</strong>{' '}
                                            <span style={{ color: blockInfo ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                                                {blockInfo ? `✓ Inside (${blockInfo})` : '✗ Outside'}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>
        </div>
    );
}
