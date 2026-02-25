import api from './api';
import type { ApiResponse, QrTokenResponse } from '../types';

export const qrService = {
    generate: async () => {
        const res = await api.post<ApiResponse<QrTokenResponse>>('/api/qr/generate');
        return res.data;
    },
};
