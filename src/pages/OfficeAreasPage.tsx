import { useEffect, useState, useRef } from 'react';
import { Plus, Edit2, Trash2, MapPin, Map as MapIcon, Briefcase, DownloadCloud } from 'lucide-react';
import { officeAreaService } from '../services/officeAreaService';
import type { OfficeAreaResponse, CreateOfficeAreaRequest, UpdateOfficeAreaRequest, OfficeAreaStatus } from '../types';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import CoverageMap from '../components/ui/CoverageMap';
import { PageLoader } from '../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

export default function OfficeAreasPage() {
    const [areas, setAreas] = useState<OfficeAreaResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editArea, setEditArea] = useState<OfficeAreaResponse | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<OfficeAreaResponse | null>(null);
    const [mapTarget, setMapTarget] = useState<OfficeAreaResponse | null>(null);
    const [saving, setSaving] = useState(false);

    // KML Import Flow States
    const globalKmlInputRef = useRef<HTMLInputElement>(null);
    const [kmlFile, setKmlFile] = useState<File | null>(null);
    const [kmlNamePrompt, setKmlNamePrompt] = useState(false);
    const [kmlName, setKmlName] = useState('');
    const [polygonCoordinates, setPolygonCoordinates] = useState<string>('');

    const [form, setForm] = useState<Partial<CreateOfficeAreaRequest> & Partial<UpdateOfficeAreaRequest>>({
        name: '',
        latitude: 0,
        longitude: 0,
        radiusMeters: 100,
        status: 'ACTIVE'
    });

    useEffect(() => {
        loadAreas();
    }, []);

    const loadAreas = async () => {
        try {
            const res = await officeAreaService.getAll();
            if (res.success) setAreas(res.data);
        } catch {
            toast.error('Failed to load office areas');
        } finally {
            setLoading(false);
        }
    };

    const openCreate = () => {
        setEditArea(null);
        setForm({ name: '', latitude: 0, longitude: 0, radiusMeters: 100 });
        setShowModal(true);
    };

    const openEdit = async (area: OfficeAreaResponse) => {
        setEditArea(area);
        setForm({
            name: area.name,
            latitude: area.latitude,
            longitude: area.longitude,
            radiusMeters: area.radiusMeters || 100,
            status: area.status,
        });
        setPolygonCoordinates('');

        if (area.polygonFileUrl) {
            try {
                const kmlUrl = area.polygonFileUrl.startsWith('http')
                    ? area.polygonFileUrl
                    : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}${area.polygonFileUrl.startsWith('/') ? '' : '/'}${area.polygonFileUrl}`;

                const response = await fetch(kmlUrl);
                const kmlText = await response.text();

                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(kmlText, "text/xml");
                const polyCoordinates = xmlDoc.getElementsByTagName("Polygon");

                if (polyCoordinates.length > 0) {
                    const coordText = polyCoordinates[0].getElementsByTagName("coordinates")[0]?.textContent;
                    if (coordText) {
                        setPolygonCoordinates(coordText.trim());
                    }
                }
            } catch (err) {
                console.error("Failed to load existing KML coordinates", err);
                toast.error("Failed to load polygon coordinates");
            }
        }

        setShowModal(true);
    };

    // Haversine distance formula in meters
    const getDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371e3; // metres
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (editArea) {
                let updatedForm = { ...form } as UpdateOfficeAreaRequest;
                let newKmlFile: File | null = null;

                // If editing a polygon and coordinates changed, we need to generate a new KML
                if (editArea.polygonFileUrl && polygonCoordinates.trim()) {
                    const coords = polygonCoordinates.trim().split(/\s+/).map(c => {
                        const [lng, lat] = c.split(',').map(Number);
                        return { lat, lng };
                    }).filter(c => !isNaN(c.lat) && !isNaN(c.lng));

                    if (coords.length >= 3) {
                        // Calculate approximate center
                        const sumLat = coords.reduce((sum, c) => sum + c.lat, 0);
                        const sumLng = coords.reduce((sum, c) => sum + c.lng, 0);
                        const centerLat = sumLat / coords.length;
                        const centerLng = sumLng / coords.length;

                        // Calculate approximate max radius
                        let maxDist = 0;
                        for (const coord of coords) {
                            const dist = getDistanceMeters(centerLat, centerLng, coord.lat, coord.lng);
                            if (dist > maxDist) maxDist = dist;
                        }

                        updatedForm.latitude = centerLat;
                        updatedForm.longitude = centerLng;
                        updatedForm.radiusMeters = Math.round(maxDist);

                        // Generate minimal KML
                        const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Placemark>
    <name>${updatedForm.name || editArea.name}</name>
    <Polygon>
      <outerBoundaryIs>
        <LinearRing>
          <coordinates>${polygonCoordinates}</coordinates>
        </LinearRing>
      </outerBoundaryIs>
    </Polygon>
  </Placemark>
</kml>`;
                        newKmlFile = new File([kmlContent], `${updatedForm.name || editArea.name}.kml`, { type: "application/vnd.google-earth.kml+xml" });
                    }
                }

                await officeAreaService.update(editArea.id, updatedForm);
                if (newKmlFile) {
                    await officeAreaService.uploadPolygon(editArea.id, newKmlFile);
                }
                toast.success('Office area updated');
            } else {
                await officeAreaService.create(form as CreateOfficeAreaRequest);
                toast.success('Office area created');
            }
            setShowModal(false);
            loadAreas();
        } catch {
            toast.error('Failed to save office area');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setSaving(true);
        try {
            await officeAreaService.delete(deleteTarget.id);
            toast.success('Office area deleted');
            setDeleteTarget(null);
            loadAreas();
        } catch {
            toast.error('Failed to delete office area');
        } finally {
            setSaving(false);
        }
    };

    const handleGlobalKmlSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setKmlFile(file);
        setKmlName(file.name.replace(/\.[^/.]+$/, '')); // default name to filename without extension
        setKmlNamePrompt(true);
        if (globalKmlInputRef.current) globalKmlInputRef.current.value = '';
    };

    const extractKmlData = (kmlText: string): { latitude: number, longitude: number, radiusMeters: number } | null => {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(kmlText, "text/xml");

            // 1. Prioritize finding a Polygon to compute center and radius
            const polyCoordinates = xmlDoc.getElementsByTagName("Polygon");
            if (polyCoordinates.length > 0) {
                const coordText = polyCoordinates[0].getElementsByTagName("coordinates")[0]?.textContent;
                if (coordText) {
                    const coords = coordText.trim().split(/\s+/).map(c => {
                        const [lng, lat] = c.split(',').map(Number);
                        return { lat, lng };
                    }).filter(c => !isNaN(c.lat) && !isNaN(c.lng));

                    if (coords.length > 0) {
                        const sumLat = coords.reduce((sum, c) => sum + c.lat, 0);
                        const sumLng = coords.reduce((sum, c) => sum + c.lng, 0);
                        const centerLat = sumLat / coords.length;
                        const centerLng = sumLng / coords.length;

                        let maxDist = 0;
                        for (const coord of coords) {
                            const dist = getDistanceMeters(centerLat, centerLng, coord.lat, coord.lng);
                            if (dist > maxDist) maxDist = dist;
                        }

                        return {
                            latitude: centerLat,
                            longitude: centerLng,
                            radiusMeters: Math.round(maxDist)
                        };
                    }
                }
            }

            // 2. Fallback to finding a Point (pin) if no valid Polygon is found
            const pointCoordinates = xmlDoc.getElementsByTagName("Point");
            if (pointCoordinates.length > 0) {
                const coordText = pointCoordinates[0].getElementsByTagName("coordinates")[0]?.textContent;
                if (coordText) {
                    const [lng, lat] = coordText.trim().split(',').map(Number);
                    if (!isNaN(lat) && !isNaN(lng)) return { latitude: lat, longitude: lng, radiusMeters: 0 };
                }
            }

        } catch (e) {
            console.error("Failed to parse KML for coordinates", e);
        }
        return null;
    };

    const handleKmlImportSubmit = async () => {
        if (!kmlFile || !kmlName.trim()) {
            toast.error("Please provide a name for the Geofence");
            return;
        }

        setSaving(true);
        try {
            // Read KML to extract center pin and calculate radius
            const kmlText = await kmlFile.text();
            const data = extractKmlData(kmlText) || { latitude: 0, longitude: 0, radiusMeters: 0 };

            // 1. Create the Geofence with extracted coordinates and computed radius
            const createRes = await officeAreaService.create({
                name: kmlName,
                latitude: data.latitude,
                longitude: data.longitude,
                radiusMeters: data.radiusMeters
            });

            if (createRes.success && createRes.data) {
                // 2. Upload the KML file to the newly created geofence
                await officeAreaService.uploadPolygon(createRes.data.id, kmlFile);
                toast.success('KML Geofence created successfully!');
                setKmlNamePrompt(false);
                setKmlFile(null);
                setKmlName('');
                loadAreas();
            }
        } catch (error) {
            toast.error('Failed to create KML Geofence');
            console.error(error);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <PageLoader />;

    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
                <button onClick={openCreate} className="btn-primary w-full sm:w-auto bg-[#3b82f6] hover:bg-[#2563eb] text-white border-0 shadow-md flex items-center gap-2 px-5 py-2.5">
                    <Plus size={18} />
                    Add New Geofence
                </button>
                <button
                    onClick={() => globalKmlInputRef.current?.click()}
                    className="btn w-full sm:w-auto bg-[#10b981] hover:bg-[#059669] text-white border-0 shadow-md flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all"
                >
                    <DownloadCloud size={18} className="rotate-180" />
                    Import from KML
                </button>
            </div>
            {/* Hidden file input for Global KML Import */}
            <input
                type="file"
                ref={globalKmlInputRef}
                onChange={handleGlobalKmlSelect}
                accept=".json,.geojson,.kml"
                className="hidden"
            />

            {/* Table layout */}
            <div className="bg-white rounded-lg shadow border border-surface-200 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-surface-200 bg-surface-50">
                    <h2 className="font-semibold text-surface-800 flex items-center gap-2 text-lg">
                        <MapPin size={20} className="text-surface-600" />
                        Existing Office Geofences ({areas.length})
                    </h2>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-[#1f2937] text-white">
                            <tr>
                                <th className="px-5 py-3 font-semibold whitespace-nowrap">NAME</th>
                                <th className="px-5 py-3 font-semibold whitespace-nowrap">AREA TYPE</th>
                                <th className="px-5 py-3 font-semibold whitespace-nowrap">GEOFENCE TYPE</th>
                                <th className="px-5 py-3 font-semibold whitespace-nowrap min-w-[150px]">LOCATION</th>
                                <th className="px-5 py-3 font-semibold whitespace-nowrap">SIZE</th>
                                <th className="px-5 py-3 font-semibold whitespace-nowrap">STATUS</th>
                                <th className="px-5 py-3 font-semibold whitespace-nowrap">CREATED</th>
                                <th className="px-5 py-3 font-semibold whitespace-nowrap">ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-100">
                            {areas.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-5 py-12 text-center text-surface-500">
                                        No office geofences found. Create one to get started.
                                    </td>
                                </tr>
                            ) : (
                                areas.map((area) => (
                                    <tr key={area.id} className="hover:bg-surface-50 transition-colors bg-white">
                                        <td className="px-5 py-4 font-bold text-surface-900">
                                            {area.name}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-[#22d3ee] text-white">
                                                <Briefcase size={12} />
                                                Office Area
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-[#22d3ee] text-white border border-[#06b6d4]">
                                                {area.polygonFileUrl ? 'Polygon' : 'Circle'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex flex-col gap-1 items-start">
                                                <div className="text-xs text-surface-700">
                                                    <div className="flex items-center gap-1">
                                                        <MapPin size={10} className="text-surface-900" />
                                                        <span className="font-semibold text-surface-900">Lat:</span> {area.latitude}
                                                    </div>
                                                    <div className="ml-3 mt-0.5">
                                                        <span className="font-semibold text-surface-900">Lng:</span> {area.longitude}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setMapTarget(area)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1 mt-2 rounded-full text-xs font-semibold border border-[#22d3ee] text-[#06b6d4] hover:bg-[#22d3ee]/10 transition-colors bg-white shadow-sm"
                                                >
                                                    <MapIcon size={12} />
                                                    View on Map
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold bg-[#22d3ee] text-white">
                                                {area.polygonFileUrl ? `Polygon (~${area.radiusMeters}m)` : `${area.radiusMeters}m`}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold ${area.status === 'ACTIVE' ? 'bg-[#10b981] text-white' : 'bg-surface-200 text-surface-600'}`}>
                                                {area.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-xs text-surface-600">
                                            <div className="whitespace-nowrap">
                                                {new Date(area.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                                            </div>
                                            <div className="mt-1">
                                                {new Date(area.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => openEdit(area)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-[#3b82f6] text-[#3b82f6] hover:bg-[#3b82f6] hover:text-white transition-colors bg-white shadow-sm whitespace-nowrap">
                                                    <Edit2 size={12} /> Edit
                                                </button>
                                                {area.status === 'ACTIVE' && (
                                                    <button onClick={() => setDeleteTarget(area)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-[#ef4444] text-[#ef4444] hover:bg-[#ef4444] hover:text-white transition-colors bg-white shadow-sm whitespace-nowrap">
                                                        <Trash2 size={12} /> Delete
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create / Edit Modal */}
            <Modal
                open={showModal}
                onClose={() => setShowModal(false)}
                title={editArea ? 'Edit Office Area' : 'Create Office Area'}
            >
                <div className="space-y-4">
                    <div>
                        <label className="label">Name</label>
                        <input
                            className="input"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="e.g. Main Office"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {(!editArea || !editArea.polygonFileUrl) && (
                            <>
                                <div>
                                    <label className="label">Latitude</label>
                                    <input
                                        className="input"
                                        type="text"
                                        value={form.latitude?.toString() ?? '0'}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '' || val === '-') {
                                                setForm({ ...form, latitude: val as any });
                                            } else if (!isNaN(Number(val))) {
                                                setForm({ ...form, latitude: Number(val) });
                                            }
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className="label">Longitude</label>
                                    <input
                                        className="input"
                                        type="text"
                                        value={form.longitude?.toString() ?? '0'}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '' || val === '-') {
                                                setForm({ ...form, longitude: val as any });
                                            } else if (!isNaN(Number(val))) {
                                                setForm({ ...form, longitude: Number(val) });
                                            }
                                        }}
                                    />
                                </div>
                            </>
                        )}
                        {editArea && (
                            <div>
                                <label className="label">Status</label>
                                <select
                                    className="input"
                                    value={form.status}
                                    onChange={(e) => setForm({ ...form, status: e.target.value as OfficeAreaStatus })}
                                >
                                    <option value="ACTIVE">Active</option>
                                    <option value="INACTIVE">Inactive</option>
                                </select>
                            </div>
                        )}
                    </div>
                    {editArea && editArea.polygonFileUrl && (
                        <div>
                            <label className="label">
                                Polygon Coordinates
                                <span className="ml-2 text-xs font-normal text-surface-500">
                                    (Enter at least 3 points. Format: latitude,longitude separated by spaces)
                                </span>
                            </label>
                            <textarea
                                className="input min-h-[120px] font-mono text-sm leading-relaxed"
                                value={polygonCoordinates}
                                onChange={(e) => setPolygonCoordinates(e.target.value)}
                                placeholder="eg: 110.35,1.54 110.36,1.54 110.35,1.55"
                            />
                        </div>
                    )}
                    {(!editArea || !editArea.polygonFileUrl) && (
                        <div>
                            <label className="label">Radius (meters)</label>
                            <input
                                className="input"
                                type="number"
                                value={form.radiusMeters || ''}
                                onChange={(e) => setForm({ ...form, radiusMeters: parseInt(e.target.value) || undefined })}
                                placeholder="100"
                            />
                        </div>
                    )}
                    <div className="flex gap-3 justify-end pt-4">
                        <button onClick={() => setShowModal(false)} className="btn-secondary">
                            Cancel
                        </button>
                        <button onClick={handleSave} className="btn-primary" disabled={saving}>
                            {saving ? 'Saving...' : editArea ? 'Update' : 'Create'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Delete confirm */}
            <ConfirmModal
                open={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                title="Delete Office Area"
                message={`Are you sure you want to permanently delete "${deleteTarget?.name}"?`}
                confirmText="Delete"
                variant="danger"
                loading={saving}
            />

            {/* KML Name Prompt Modal */}
            <Modal
                open={kmlNamePrompt}
                onClose={() => setKmlNamePrompt(false)}
                title="Name Your Geofence"
            >
                <div className="space-y-4">
                    <p className="text-sm text-surface-600">
                        You are importing: <span className="font-semibold text-surface-900">{kmlFile?.name}</span>
                    </p>
                    <div>
                        <label className="label">Geofence Name</label>
                        <input
                            className="input"
                            value={kmlName}
                            onChange={(e) => setKmlName(e.target.value)}
                            placeholder="e.g. Headquarters"
                            autoFocus
                        />
                    </div>
                    <div className="flex gap-3 justify-end pt-4">
                        <button onClick={() => setKmlNamePrompt(false)} className="btn-secondary">
                            Cancel
                        </button>
                        <button onClick={handleKmlImportSubmit} className="btn-primary" disabled={saving || !kmlName.trim()}>
                            {saving ? 'Creating...' : 'Create Geofence'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Map Modal */}
            <Modal
                open={!!mapTarget}
                onClose={() => setMapTarget(null)}
                title={`Coverage Area: ${mapTarget?.name}`}
            >
                {mapTarget && (
                    <div className="h-[500px]">
                        <CoverageMap
                            latitude={mapTarget.latitude}
                            longitude={mapTarget.longitude}
                            radiusMeters={mapTarget.radiusMeters || undefined}
                            polygonFileUrl={mapTarget.polygonFileUrl}
                        />
                    </div>
                )}
            </Modal>
        </div>
    );
}
