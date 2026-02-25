import clsx from 'clsx';
import type { AttendanceStatus, UserStatus, OfficeAreaStatus, ClockInType } from '../../types';

type StatusType = AttendanceStatus | UserStatus | OfficeAreaStatus | ClockInType | string;

const statusConfig: Record<string, string> = {
    ACTIVE: 'badge-success',
    INACTIVE: 'badge-neutral',
    PENDING: 'badge-warning',
    APPROVED: 'badge-success',
    REJECTED: 'badge-danger',
    NORMAL: 'badge-success',
    LATE: 'badge-warning',
    OUTSTATION: 'badge-info',
    ABSENT: 'badge-danger',
    EARLY: 'badge-warning',
    ADMIN: 'badge-info',
    QR_OPERATOR: 'badge-neutral',
    OFFICE_STAFF: 'badge-success',
    FIELD_STAFF: 'badge-warning',
};

interface StatusBadgeProps {
    status: StatusType;
    className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
    const badgeClass = statusConfig[status] || 'badge-neutral';
    const display = status.replace(/_/g, ' ');

    return (
        <span className={clsx(badgeClass, className)}>{display}</span>
    );
}
