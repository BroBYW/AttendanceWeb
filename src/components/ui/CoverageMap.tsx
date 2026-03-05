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

const defaultPolygonStyle = {
    color: '#3b82f6',
    weight: 3,
    opacity: 0.8,
    fillColor: '#3b82f6',
    fillOpacity: 0.2,
};

// Distinct colors for block outlines
const blockColors = [
    '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4',
    '#42d4f4', '#f032e6', '#bfef45', '#fabed4', '#469990',
    '#dcbeff', '#9A6324', '#fffac8', '#800000', '#aaffc3',
    '#808000', '#ffd8b1', '#000075', '#a9a9a9', '#e6beff',
    '#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#e74c3c',
    '#f39c12', '#1f77b4',
];

function getBlockStyle(feature?: GeoJSON.Feature): L.PathOptions {
    if (!feature?.properties?.Blockno) {
        return defaultPolygonStyle;
    }
    const blockno = Number(feature.properties.Blockno);
    const colorIndex = (blockno - 1) % blockColors.length;
    const color = blockColors[colorIndex >= 0 ? colorIndex : 0];
    return {
        color: color,
        weight: 2.5,
        opacity: 0.9,
        fillColor: color,
        fillOpacity: 0.15,
    };
}

interface CoverageMapProps {
    latitude: number;
    longitude: number;
    radiusMeters?: number;
    polygonFileUrl?: string | null;
    geojsonData?: string | null;
}

/**
 * Renders a polygon from stored GeoJSON data (preferred)
 * or falls back to KML file URL via omnivore.
 */
function PolygonLayer({ geojsonData, polygonFileUrl }: { geojsonData?: string | null; polygonFileUrl?: string | null }) {
    const map = useMap();
    const layerRef = useRef<L.GeoJSON | null>(null);

    useEffect(() => {
        // Clean up previous layer
        if (layerRef.current) {
            map.removeLayer(layerRef.current);
            layerRef.current = null;
        }

        // Priority 1: Use stored GeoJSON data (parsed directly, no network request)
        if (geojsonData) {
            try {
                const parsed = JSON.parse(geojsonData);
                const layer = L.geoJSON(parsed, {
                    style: (feature) => getBlockStyle(feature as GeoJSON.Feature),
                    onEachFeature: (feature, layer) => {
                        if (feature.properties) {
                            const props = feature.properties;
                            // Normalize property names (handle TaskNo vs Taskno, etc.)
                            const taskNo = props.TaskNo ?? props.Taskno;
                            const blockHa = props.BlockAreaH ?? props.BlockHa;
                            const ed = props.ED ?? props.Ed;
                            const edb = props.EDB ?? props.Edb;

                            // Hover tooltip (short label)
                            const parts: string[] = [];
                            if (props.Estate) parts.push(`Estate: ${props.Estate}`);
                            if (props.Division != null) parts.push(`Div ${props.Division}`);
                            if (props.Blockno) parts.push(`Block ${props.Blockno}`);
                            if (taskNo) parts.push(`Task ${taskNo}`);
                            if (props.AreaHa) parts.push(`${props.AreaHa} ha`);
                            if (parts.length > 0) {
                                layer.bindTooltip(parts.join(' · '), { sticky: true, className: 'block-tooltip' });
                            }

                            // Click popup (detailed info)
                            const popupHtml = `
                                <div style="font-family: system-ui, sans-serif; min-width: 160px;">
                                    <div style="font-weight: 700; font-size: 14px; margin-bottom: 6px; color: #1e293b;">
                                        ${props.Estate ? `${props.Estate} ` : ''}${props.Blockno ? `Block ${props.Blockno}` : 'Area Details'}
                                    </div>
                                    <table style="font-size: 12px; color: #475569; border-collapse: collapse; width: 100%;">
                                        ${props.Estate ? `<tr><td style="padding: 2px 8px 2px 0; font-weight: 600;">Estate</td><td>${props.Estate}</td></tr>` : ''}
                                        ${props.Division != null ? `<tr><td style="padding: 2px 8px 2px 0; font-weight: 600;">Division</td><td>${props.Division}</td></tr>` : ''}
                                        ${taskNo ? `<tr><td style="padding: 2px 8px 2px 0; font-weight: 600;">Task</td><td>${taskNo}</td></tr>` : ''}
                                        ${ed ? `<tr><td style="padding: 2px 8px 2px 0; font-weight: 600;">ED</td><td>${ed}</td></tr>` : ''}
                                        ${edb ? `<tr><td style="padding: 2px 8px 2px 0; font-weight: 600;">EDB</td><td>${edb}</td></tr>` : ''}
                                        ${props.Census ? `<tr><td style="padding: 2px 8px 2px 0; font-weight: 600;">Census</td><td>${props.Census}</td></tr>` : ''}
                                        ${props.AreaHa ? `<tr><td style="padding: 2px 8px 2px 0; font-weight: 600;">Area</td><td>${props.AreaHa} ha</td></tr>` : ''}
                                        ${blockHa ? `<tr><td style="padding: 2px 8px 2px 0; font-weight: 600;">Block Area</td><td>${blockHa} ha</td></tr>` : ''}
                                    </table>
                                </div>
                            `;
                            layer.bindPopup(popupHtml, { maxWidth: 250 });

                            // Flash and zoom to task on click
                            layer.on('click', () => {
                                const polyLayer = layer as L.Polygon;
                                const origStyle = getBlockStyle(feature as GeoJSON.Feature);

                                // Flash effect: toggle between highlight and original 3 times
                                let count = 0;
                                const flashInterval = setInterval(() => {
                                    if (count % 2 === 0) {
                                        polyLayer.setStyle({
                                            fillOpacity: 0.6,
                                            weight: 5,
                                            color: '#ffffff',
                                        });
                                    } else {
                                        polyLayer.setStyle({
                                            fillOpacity: origStyle.fillOpacity,
                                            weight: origStyle.weight,
                                            color: origStyle.color,
                                        });
                                    }
                                    count++;
                                    if (count >= 6) {
                                        clearInterval(flashInterval);
                                        polyLayer.setStyle(origStyle);
                                    }
                                }, 150);

                                // Zoom to the clicked polygon
                                if ('getBounds' in polyLayer) {
                                    map.fitBounds(polyLayer.getBounds(), { padding: [40, 40] });
                                }
                            });
                        }
                    }
                }).addTo(map);
                map.fitBounds(layer.getBounds());
                layerRef.current = layer;
                return;
            } catch (err) {
                console.error('Failed to parse stored GeoJSON, falling back to file URL:', err);
            }
        }

        // Priority 2: Fallback to loading from URL via omnivore (legacy KML support)
        if (polygonFileUrl) {
            const url = polygonFileUrl.startsWith('http')
                ? polygonFileUrl
                : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}${polygonFileUrl.startsWith('/') ? '' : '/'}${polygonFileUrl}`;

            const customLayer = L.geoJSON(null, { style: () => defaultPolygonStyle });
            const runLayer = omnivore.kml(url, null, customLayer)
                .on('ready', function () {
                    map.fitBounds(runLayer.getBounds());
                })
                .addTo(map);

            layerRef.current = runLayer;
        }

        return () => {
            if (layerRef.current) {
                map.removeLayer(layerRef.current);
            }
        };
    }, [geojsonData, polygonFileUrl, map]);

    return null;
}

export default function CoverageMap({ latitude, longitude, radiusMeters, polygonFileUrl, geojsonData }: CoverageMapProps) {
    const center: [number, number] = [
        latitude !== undefined && latitude !== null ? latitude : 0,
        longitude !== undefined && longitude !== null ? longitude : 0
    ];

    const hasPolygon = !!geojsonData || !!polygonFileUrl;

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

                {/* Render polygon from GeoJSON data or KML file */}
                {hasPolygon && (
                    <PolygonLayer geojsonData={geojsonData} polygonFileUrl={polygonFileUrl} />
                )}

                {/* If NO polygon, but we have radius and coordinates, render a Circle */}
                {!hasPolygon && radiusMeters && latitude && longitude && (
                    <Circle
                        center={center}
                        radius={radiusMeters}
                        pathOptions={{
                            color: '#10b981',
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
