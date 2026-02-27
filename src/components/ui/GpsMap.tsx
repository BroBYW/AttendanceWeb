import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet';
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

interface Props {
    logs: GpsLogResponse[];
    officeAreas: OfficeAreaResponse[];
}

export default function GpsMap({ logs, officeAreas }: Props) {
    // If no logs, fallback to a default view (e.g. standard coords)
    const defaultCenter: [number, number] = [2.340590, 111.845049];

    // Sort logs chronologically to draw the path correctly
    const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const tracePoints: [number, number][] = sortedLogs.map(log => [log.latitude, log.longitude]);

    // Calculate bounds if we have points
    const bounds = tracePoints.length > 0 ? L.latLngBounds(tracePoints) : null;

    // Also include office areas in bounds if desired, but sticking to logs is usually better to focus on the person.

    const getIconForStatus = (status: string | null) => {
        switch (status) {
            case 'NORMAL': return icons.NORMAL;
            case 'OUTSTATION': return icons.OUTSTATION;
            case 'OUTSIDE': return icons.OUTSIDE;
            default: return icons.DEFAULT;
        }
    };

    return (
        <MapContainer
            bounds={bounds || undefined}
            center={!bounds ? defaultCenter : undefined}
            zoom={!bounds ? 13 : undefined}
            style={{ height: '100%', width: '100%', minHeight: '400px' }}
            scrollWheelZoom={true}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Draw active office areas (Circles) */}
            {officeAreas.map(area => {
                if (area.radiusMeters && area.latitude && area.longitude) {
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

            {/* Draw active office areas (Polygons) */}
            {/* Note: Polygons from KML are more complex to parse purely on the client side without extensions, 
                so we focus on the circles/points first. If polygon parsing is required, we can add a KML parser later. */}

            {/* Draw the movement trace line */}
            <Polyline
                positions={tracePoints}
                pathOptions={{ color: '#3b82f6', weight: 3, dashArray: '5, 10' }}
            />

            {/* Plot each log point */}
            {sortedLogs.map(log => (
                <Marker
                    key={log.id}
                    position={[log.latitude, log.longitude]}
                    icon={getIconForStatus(log.areaStatus)}
                >
                    <Popup>
                        <div className="text-xs">
                            <strong>Time:</strong> {new Date(log.timestamp).toLocaleTimeString()}<br />
                            <strong>Status:</strong> {log.areaStatus}<br />
                            {log.accuracy && <><strong>Accuracy:</strong> ±{log.accuracy.toFixed(0)}m</>}
                        </div>
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
}
