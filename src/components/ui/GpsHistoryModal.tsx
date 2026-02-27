import { useEffect, useState } from 'react';
import Modal from './Modal';
import type { GpsLogResponse, OfficeAreaResponse } from '../../types';
import { getUserGpsLogs } from '../../services/gpsLogService';
import { officeAreaService } from '../../services/officeAreaService';
import { PageLoader } from './LoadingSpinner';
import toast from 'react-hot-toast';
import { MapPin, Map, List } from 'lucide-react';
import GpsMap from './GpsMap';

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

    useEffect(() => {
        if (open && userId) {
            fetchLogs();
        } else {
            setLogs([]); // Reset on close
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
                setOfficeAreas(areasData.data.filter((a: OfficeAreaResponse) => a.status === 'ACTIVE'));
            }
        } catch (error) {
            toast.error('Failed to load GPS history or areas');
        } finally {
            setLoading(false);
        }
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

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={`GPS History: ${userName}`}
        >
            <div className="flex flex-col h-[75vh]">
                <div className="flex items-center justify-end gap-2 mb-4">
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
                                    <GpsMap logs={logs} officeAreas={officeAreas} />
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
                                            {logs.map((log) => (
                                                <tr key={log.id} className="hover:bg-primary-50 transition-colors">
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
                                                            {log.areaStatus || 'UNKNOWN'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
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
