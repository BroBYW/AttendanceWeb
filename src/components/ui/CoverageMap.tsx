import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// leaflet-omnivore doesn't have reliable TypeScript types, so we use require
// @ts-expect-error leaflet-omnivore does not have typescript definitions
import omnivore from 'leaflet-omnivore';

// Fix for default marker icons in Leaflet when using Webpack/Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface CoverageMapProps {
    latitude: number;
    longitude: number;
    radiusMeters?: number;
    polygonFileUrl?: string | null;
}

/**
 * Component to handle KML loading onto the map.
 * Must be rendered inside <MapContainer> as it uses useMap().
 */
function KmlLayer({ url }: { url: string }) {
    const map = useMap();
    const layerRef = useRef<L.GeoJSON | null>(null);

    useEffect(() => {
        if (!url) return;

        // Custom style for the KML polygons
        const customLayer = L.geoJSON(null, {
            style: function () {
                return {
                    color: '#3b82f6', // primary blue
                    weight: 3,
                    opacity: 0.8,
                    fillColor: '#3b82f6',
                    fillOpacity: 0.2,
                };
            },
        });

        // Load KML
        const runLayer = omnivore.kml(url, null, customLayer).on('ready', function () {
            // Fit the map bounds to the loaded KML
            map.fitBounds(runLayer.getBounds());
        }).addTo(map);

        layerRef.current = runLayer;

        return () => {
            if (layerRef.current) {
                map.removeLayer(layerRef.current);
            }
        };
    }, [url, map]);

    return null;
}

export default function CoverageMap({ latitude, longitude, radiusMeters, polygonFileUrl }: CoverageMapProps) {
    // Determine the center. If there's a valid latitude/longitude, use it. Otherwise, default to some fallback (e.g. 0,0).
    // The KmlLayer will auto-recenter if a KML is loaded.
    const center: [number, number] = [
        latitude !== undefined && latitude !== null ? latitude : 0,
        longitude !== undefined && longitude !== null ? longitude : 0
    ];

    return (
        <div className="w-full h-full min-h-[400px] rounded-xl overflow-hidden border border-surface-200">
            <MapContainer
                center={center}
                zoom={15}
                scrollWheelZoom={true}
                className="w-full h-full min-h-[400px]"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* If there's a KML file, we render the KML Layer which handles parsing and bounding */}
                {polygonFileUrl && (
                    <KmlLayer url={polygonFileUrl.startsWith('http') ? polygonFileUrl : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}${polygonFileUrl.startsWith('/') ? '' : '/'}${polygonFileUrl}`} />
                )}

                {/* If NO KML file, but we have radius and coordinates, render a Circle */}
                {!polygonFileUrl && radiusMeters && latitude && longitude && (
                    <Circle
                        center={center}
                        radius={radiusMeters}
                        pathOptions={{
                            color: '#10b981', // emerald green
                            fillColor: '#10b981',
                            fillOpacity: 0.2,
                            weight: 2
                        }}
                    />
                )}

                {/* Fallback marker for the exact center point if coordinates exist */}
                {latitude && longitude && (
                    <Circle
                        center={center}
                        radius={2}
                        pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1 }}
                    />
                )}
            </MapContainer>
        </div>
    );
}
