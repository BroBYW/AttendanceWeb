import { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polygon, GeoJSON } from 'react-leaflet';
import type { OfficeAreaResponse } from '../../types';
import L from 'leaflet';
import Modal from './Modal';

// Fix for default marker icons in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

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

// Component to auto-open the parent Marker's popup once the map is ready
function AutoOpenPopup({ markerRef }: { markerRef: React.RefObject<L.Marker | null> }) {
    const map = useMap();
    useEffect(() => {
        // Short delay to ensure map + marker are fully rendered
        const timer = setTimeout(() => {
            if (markerRef.current) {
                markerRef.current.openPopup();
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [map, markerRef]);
    return null;
}

// Block color palette for GeoJSON features
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

export type LocationStatusType = 'Normal' | 'Outstation' | 'Outside Working Area';

interface Props {
    open: boolean;
    onClose: () => void;
    latitude: number;
    longitude: number;
    title: string;
    time: string | null;
    status: string | null;
    /** User location status: Normal, Outstation, or Outside Working Area */
    locationStatus?: LocationStatusType | null;
    officeAreas?: OfficeAreaResponse[];
}

export default function SinglePointMapModal({ open, onClose, latitude, longitude, title, time, status, locationStatus, officeAreas = [] }: Props) {
    const markerRef = useRef<L.Marker | null>(null);
    const [kmlPolygons, setKmlPolygons] = useState<{ id: number; name: string; coordinates: [number, number][] }[]>([]);

    // Parse GeoJSON data from office areas
    const geojsonLayers = useMemo(() => {
        const layers: { id: number; name: string; data: GeoJSON.FeatureCollection }[] = [];
        for (const area of officeAreas) {
            if (area.geojsonData) {
                try {
                    const parsed = JSON.parse(area.geojsonData) as GeoJSON.FeatureCollection;
                    layers.push({ id: area.id, name: area.name, data: parsed });
                } catch (err) {
                    console.error('Failed to parse GeoJSON for area ' + area.name, err);
                }
            }
        }
        return layers;
    }, [officeAreas]);

    // Extract polygon rings for point-in-polygon detection
    const polygonRings = useMemo(() => {
        const rings: { estate: string; division: number; blockno: number; taskno: number; ring: number[][] }[] = [];
        for (const layer of geojsonLayers) {
            if (!layer.data.features) continue;
            for (const feature of layer.data.features) {
                const geom = feature.geometry;
                const props = feature.properties || {};
                const estate = String(props.Estate || '');
                const division = Number(props.Division || 0);
                const blockno = Number(props.Blockno || 0);
                const taskno = Number(props.TaskNo ?? props.Taskno ?? 0);
                if (geom.type === 'Polygon' && geom.coordinates?.[0]) {
                    rings.push({ estate, division, blockno, taskno, ring: geom.coordinates[0] as number[][] });
                } else if (geom.type === 'MultiPolygon') {
                    for (const poly of geom.coordinates) {
                        if (poly[0]) {
                            rings.push({ estate, division, blockno, taskno, ring: poly[0] as number[][] });
                        }
                    }
                }
            }
        }
        return rings;
    }, [geojsonLayers]);

    // Frontend point-in-polygon check
    const polygonResult = useMemo(() => {
        if (polygonRings.length === 0) return null;
        return findContainingBlock(latitude, longitude, polygonRings);
    }, [latitude, longitude, polygonRings]);

    useEffect(() => {
        if (!open || officeAreas.length === 0) return;

        const fetchKmlPolygons = async () => {
            const parsedPolygons: { id: number; name: string; coordinates: [number, number][] }[] = [];

            for (const area of officeAreas) {
                if (area.polygonFileUrl && !area.geojsonData) {
                    try {
                        const response = await fetch(`http://localhost:8080${area.polygonFileUrl}`);
                        if (!response.ok) continue;

                        const kmlText = await response.text();
                        const parser = new DOMParser();
                        const xmlDoc = parser.parseFromString(kmlText, "text/xml");
                        const coordsNode = xmlDoc.getElementsByTagName("coordinates")[0];

                        if (coordsNode && coordsNode.textContent) {
                            const pointsStr = coordsNode.textContent.trim().split(/\s+/);
                            const coordinates: [number, number][] = [];

                            pointsStr.forEach(coord => {
                                const parts = coord.split(',');
                                if (parts.length >= 2) {
                                    const lng = parseFloat(parts[0]);
                                    const lat = parseFloat(parts[1]);
                                    if (!isNaN(lat) && !isNaN(lng)) {
                                        coordinates.push([lat, lng]);
                                    }
                                }
                            });

                            if (coordinates.length > 0) {
                                parsedPolygons.push({
                                    id: area.id,
                                    name: area.name,
                                    coordinates: coordinates
                                });
                            }
                        }
                    } catch (error) {
                        console.error('Failed to fetch/parse KML for area ' + area.name, error);
                    }
                }
            }
            setKmlPolygons(parsedPolygons);
        };

        fetchKmlPolygons();
    }, [open, officeAreas]);

    if (!open) return null;

    const position: [number, number] = [latitude, longitude];

    return (
        <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-5xl">
            <div className="flex flex-col h-[65vh] min-h-[400px]">
                <div className="flex-1 relative border border-surface-200 rounded-lg overflow-hidden">
                    <MapContainer
                        center={position}
                        zoom={16}
                        style={{ height: '100%', width: '100%' }}
                        scrollWheelZoom={true}
                    >
                        <MapResizer />
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />

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

                        <Marker
                            position={position}
                            ref={markerRef}
                        >
                            <AutoOpenPopup markerRef={markerRef} />
                            <Popup>
                                <div className="text-xs leading-relaxed">
                                    <strong>Time:</strong> {time || '—'}<br />
                                    <strong>Status:</strong> {status || '—'}<br />
                                    <strong>Coordinates:</strong> {latitude.toFixed(5)}, {longitude.toFixed(5)}<br />
                                    {polygonRings.length > 0 && (
                                        <>
                                            <strong>Polygon:</strong>{' '}
                                            {locationStatus ? (
                                                <span style={{
                                                    color: locationStatus === 'Normal' ? '#10b981'
                                                        : locationStatus === 'Outstation' ? '#f59e0b'
                                                            : '#ef4444',
                                                    fontWeight: 600
                                                }}>
                                                    {locationStatus === 'Normal' ? '✓' : locationStatus === 'Outstation' ? '⚠' : '✗'} {locationStatus}
                                                    {locationStatus === 'Normal' && polygonResult ? ` (${polygonResult})` : ''}
                                                </span>
                                            ) : polygonResult ? (
                                                <span style={{ color: '#10b981', fontWeight: 600 }}>
                                                    ✓ Inside ({polygonResult})
                                                </span>
                                            ) : (
                                                <span style={{ color: '#ef4444', fontWeight: 600 }}>
                                                    ✗ Outside
                                                </span>
                                            )}
                                        </>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    </MapContainer>
                </div>
                {/* Bottom status bar with frontend polygon detection */}
                <div className="flex items-center justify-between pt-3 border-t border-surface-200 mt-3">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-surface-500">Location status:</span>
                        {locationStatus != null ? (
                            <span
                                className={locationStatus === 'Normal'
                                    ? 'badge-success'
                                    : locationStatus === 'Outstation'
                                        ? 'badge-info'
                                        : 'badge-warning'}
                            >
                                {locationStatus}
                            </span>
                        ) : polygonRings.length > 0 ? (
                            <span className={polygonResult ? 'badge-success' : 'badge-warning'}>
                                {polygonResult ? `✓ Inside (${polygonResult})` : '✗ Outside polygon'}
                            </span>
                        ) : (
                            <span className="text-sm text-surface-400">No polygon data</span>
                        )}
                    </div>
                    <button onClick={onClose} className="btn-secondary">
                        Close
                    </button>
                </div>
            </div>
        </Modal>
    );
}
