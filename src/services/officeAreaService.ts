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

    deactivate: async (id: number) => {
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
        return res.data;
    },
};
