import api from './api';
import type { ApiResponse, GpsLogResponse } from '../types';

export const getUserGpsLogs = async (userId: number): Promise<GpsLogResponse[]> => {
    const response = await api.get<ApiResponse<GpsLogResponse[]>>(`/api/gps-logs/user/${userId}`);
    return response.data.data;
};
