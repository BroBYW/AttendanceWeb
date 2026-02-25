import api from './api';
import type { ApiResponse, LoginRequest, LoginResponse } from '../types';

export const authService = {
    login: async (data: LoginRequest) => {
        const res = await api.post<ApiResponse<LoginResponse>>('/api/auth/login', data);
        return res.data;
    },

    refresh: async () => {
        const refreshToken = localStorage.getItem('refreshToken');
        const res = await api.post<ApiResponse<LoginResponse>>(
            '/api/auth/refresh',
            null,
            { headers: { Authorization: `Bearer ${refreshToken}` } },
        );
        return res.data;
    },
};
