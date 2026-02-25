import api from './api';
import type {
    ApiResponse,
    AttendanceResponse,
    AttendanceStatus,
    Page,
} from '../types';

export interface AttendanceFilters {
    userId?: number;
    status?: AttendanceStatus;
    startDate?: string;
    endDate?: string;
    page?: number;
    size?: number;
}

export const attendanceService = {
    getAll: async (filters: AttendanceFilters = {}) => {
        const params: Record<string, string | number> = {};
        if (filters.userId) params.userId = filters.userId;
        if (filters.status) params.status = filters.status;
        if (filters.startDate) params.startDate = filters.startDate;
        if (filters.endDate) params.endDate = filters.endDate;
        params.page = filters.page ?? 0;
        params.size = filters.size ?? 20;

        const res = await api.get<ApiResponse<Page<AttendanceResponse>>>('/api/attendance/all', { params });
        return res.data;
    },

    getById: async (id: number) => {
        const res = await api.get<ApiResponse<AttendanceResponse>>(`/api/attendance/${id}`);
        return res.data;
    },

    approve: async (id: number) => {
        const res = await api.put<ApiResponse<AttendanceResponse>>(`/api/attendance/${id}/approve`);
        return res.data;
    },

    reject: async (id: number, notes?: string) => {
        const res = await api.put<ApiResponse<AttendanceResponse>>(
            `/api/attendance/${id}/reject`,
            notes ? { notes } : undefined,
        );
        return res.data;
    },
};
