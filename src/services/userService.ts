import api from './api';
import type {
    ApiResponse,
    UserResponse,
    CreateUserRequest,
    UpdateUserRequest,
} from '../types';

export const userService = {
    getAll: async () => {
        const res = await api.get<ApiResponse<UserResponse[]>>('/api/admin/users');
        return res.data;
    },

    getById: async (id: number) => {
        const res = await api.get<ApiResponse<UserResponse>>(`/api/admin/users/${id}`);
        return res.data;
    },

    create: async (data: CreateUserRequest) => {
        const res = await api.post<ApiResponse<UserResponse>>('/api/admin/users', data);
        return res.data;
    },

    update: async (id: number, data: UpdateUserRequest) => {
        const res = await api.put<ApiResponse<UserResponse>>(`/api/admin/users/${id}`, data);
        return res.data;
    },

    deactivate: async (id: number) => {
        const res = await api.delete<ApiResponse<void>>(`/api/admin/users/${id}`);
        return res.data;
    },

    reactivate: async (id: number) => {
        const res = await api.put<ApiResponse<void>>(`/api/admin/users/${id}/reactivate`);
        return res.data;
    },
};
