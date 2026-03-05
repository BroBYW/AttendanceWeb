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

    let display = status.replace(/_/g, ' ');
    if (status === 'LATE') display = 'Late Clock-In';
    if (status === 'EARLY') display = 'Early Clock-Out';

    return (
        <span className={clsx(badgeClass, className)}>{display}</span>
    );
}
