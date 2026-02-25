import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { UserResponse } from '../types';
import { authService } from '../services/authService';

interface AuthContextType {
    user: UserResponse | null;
    token: string | null;
    isAuthenticated: boolean;
    isAdmin: boolean;
    isQrOperator: boolean;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserResponse | null>(() => {
        const saved = localStorage.getItem('user');
        return saved ? JSON.parse(saved) : null;
    });

    const [token, setToken] = useState<string | null>(() =>
        localStorage.getItem('accessToken'),
    );

    const isAuthenticated = !!token && !!user;
    const isAdmin = user?.role === 'ADMIN';
    const isQrOperator = user?.role === 'QR_OPERATOR';

    useEffect(() => {
        if (token) {
            localStorage.setItem('accessToken', token);
        } else {
            localStorage.removeItem('accessToken');
        }
    }, [token]);

    useEffect(() => {
        if (user) {
            localStorage.setItem('user', JSON.stringify(user));
        } else {
            localStorage.removeItem('user');
        }
    }, [user]);

    const login = async (username: string, password: string) => {
        const res = await authService.login({ username, password });
        if (res.success) {
            setToken(res.data.accessToken);
            setUser(res.data.user);
            localStorage.setItem('refreshToken', res.data.refreshToken);
        } else {
            throw new Error(res.message || 'Login failed');
        }
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
    };

    return (
        <AuthContext.Provider
            value={{ user, token, isAuthenticated, isAdmin, isQrOperator, login, logout }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
