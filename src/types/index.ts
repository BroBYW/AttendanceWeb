// ─── User ───────────────────────────────────────────────────
export interface UserResponse {
    id: number;
    username: string;
    employeeId: string;
    name: string;
    department: string | null;
    role: Role;
    status: UserStatus;
    createdAt: string;
}

export type Role = 'ADMIN' | 'QR_OPERATOR' | 'OFFICE_STAFF' | 'FIELD_STAFF';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface CreateUserRequest {
    username: string;
    name: string;
    password: string;
    department?: string;
    role: Role;
}

export interface UpdateUserRequest {
    name?: string;
    department?: string;
    role?: Role;
    status?: UserStatus;
    password?: string;
}

// ─── Office Area ────────────────────────────────────────────
export interface OfficeAreaResponse {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    radiusMeters: number | null;
    polygonFilePath: string | null;
    polygonFileUrl: string | null;
    status: OfficeAreaStatus;
    createdAt: string;
}

export type OfficeAreaStatus = 'ACTIVE' | 'INACTIVE';

export interface CreateOfficeAreaRequest {
    name: string;
    latitude: number;
    longitude: number;
    radiusMeters?: number;
}

export interface UpdateOfficeAreaRequest {
    name?: string;
    latitude?: number;
    longitude?: number;
    radiusMeters?: number;
    status?: OfficeAreaStatus;
}

// ─── Attendance ─────────────────────────────────────────────
export type ClockInType = 'NORMAL' | 'LATE' | 'OUTSTATION' | 'ABSENT';
export type ClockOutType = 'NORMAL' | 'EARLY';
export type AttendanceStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AttendanceResponse {
    id: number;
    userId: number;
    userName: string;
    employeeId: string;
    officeAreaId: number | null;
    officeAreaName: string | null;
    attendanceDate: string;
    clockInTime: string | null;
    clockInLat: number | null;
    clockInLng: number | null;
    clockInType: ClockInType | null;
    clockInPhotoUrl: string | null;
    clockOutTime: string | null;
    clockOutLat: number | null;
    clockOutLng: number | null;
    clockOutType: ClockOutType | null;
    clockOutPhotoUrl: string | null;
    workingMinutes: number | null;
    status: AttendanceStatus;
    reason: string | null;
    documentUrl: string | null;
    notes: string | null;
    reviewedById: number | null;
    reviewedByName: string | null;
    reviewedAt: string | null;
}

// ─── QR Token ───────────────────────────────────────────────
export interface QrTokenResponse {
    id: number;
    token: string;
    expiresAt: string;
    used: boolean;
    createdAt: string;
}

// ─── Auth ───────────────────────────────────────────────────
export interface LoginRequest {
    username: string;
    password: string;
}

export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: number;
    user: UserResponse;
}

// ─── API Wrapper ────────────────────────────────────────────
export interface ApiResponse<T> {
    success: boolean;
    message: string;
    data: T;
}

// ─── Spring Data Page ───────────────────────────────────────
export interface Page<T> {
    content: T[];
    totalElements: number;
    totalPages: number;
    size: number;
    number: number;
    first: boolean;
    last: boolean;
    empty: boolean;
}
