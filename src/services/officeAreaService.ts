import api from './api';
import type {
    ApiResponse,
    OfficeAreaResponse,
    CreateOfficeAreaRequest,
    UpdateOfficeAreaRequest,
} from '../types';

export const officeAreaService = {
    getAll: async () => {
        const res = await api.get<ApiResponse<OfficeAreaResponse[]>>('/api/admin/office-areas');
        return res.data;
    },

    getById: async (id: number) => {
        const res = await api.get<ApiResponse<OfficeAreaResponse>>(`/api/admin/office-areas/${id}`);
        return res.data;
    },

    create: async (data: CreateOfficeAreaRequest) => {
        const res = await api.post<ApiResponse<OfficeAreaResponse>>('/api/admin/office-areas', data);
        return res.data;
    },

    update: async (id: number, data: UpdateOfficeAreaRequest) => {
        const res = await api.put<ApiResponse<OfficeAreaResponse>>(`/api/admin/office-areas/${id}`, data);
        return res.data;
    },

    delete: async (id: number) => {
        const res = await api.delete<ApiResponse<void>>(`/api/admin/office-areas/${id}`);
        return res.data;
    },

    uploadPolygon: async (id: number, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post<ApiResponse<OfficeAreaResponse>>(
            `/api/admin/office-areas/${id}/polygon`,
            formData,
            { headers: { 'Content-Type': 'multipart/form-data' } },
        );
        // Invalidate geojson cache since polygon data changed
        sessionStorage.removeItem('geojson-map-cache');
        return res.data;
    },

    importBlocks: async (name: string, file: File) => {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('file', file);
        const res = await api.post<ApiResponse<OfficeAreaResponse[]>>(
            '/api/admin/office-areas/import-blocks',
            formData,
            { headers: { 'Content-Type': 'multipart/form-data' } },
        );
        // Invalidate geojson cache since new polygons were imported
        sessionStorage.removeItem('geojson-map-cache');
        return res.data;
    },

    /**
     * Fetch geojsonData for all areas as a map of id → geojsonData object.
     * Cached in sessionStorage for 10 minutes.
     */
    getGeojsonMap: async () => {
        const CACHE_KEY = 'geojson-map-cache';
        const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

        try {
            const cached = sessionStorage.getItem(CACHE_KEY);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < CACHE_TTL_MS) {
                    return { success: true, message: 'cached', data } as ApiResponse<Record<number, object>>;
                }
            }
        } catch { /* ignore parse errors */ }

        const res = await api.get<ApiResponse<Record<number, object>>>('/api/admin/office-areas/geojson-map');

        if (res.data.success && res.data.data) {
            try {
                sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                    data: res.data.data,
                    timestamp: Date.now(),
                }));
            } catch { /* sessionStorage full — still return the data */ }
        }

        return res.data;
    },

    /** Force clear the geojson cache (call after polygon changes) */
    invalidateGeojsonCache: () => {
        sessionStorage.removeItem('geojson-map-cache');
    },
};
