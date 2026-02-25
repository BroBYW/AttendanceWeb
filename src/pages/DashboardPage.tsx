import { useEffect, useState } from 'react';
import { Users, ClipboardList, ShieldCheck, MapPin, QrCode } from 'lucide-react';
import { userService } from '../services/userService';
import { attendanceService } from '../services/attendanceService';
import { officeAreaService } from '../services/officeAreaService';
import { PageLoader } from '../components/ui/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

interface StatCard {
    label: string;
    value: number | string;
    icon: React.ElementType;
    gradient: string;
    shadowColor: string;
}

export default function DashboardPage() {
    const [stats, setStats] = useState<StatCard[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    useEffect(() => {
        if (user?.role === 'QR_OPERATOR') {
            setLoading(false);
            return;
        }
        loadStats();
    }, [user]);

    const loadStats = async () => {
        try {
            const [usersRes, attendanceRes, areasRes, pendingRes] = await Promise.allSettled([
                userService.getAll(),
                attendanceService.getAll({ page: 0, size: 1 }),
                officeAreaService.getAll(),
                attendanceService.getAll({ status: 'PENDING', page: 0, size: 1 }),
            ]);

            const totalUsers = usersRes.status === 'fulfilled' ? usersRes.value.data.length : '—';
            const totalAttendance =
                attendanceRes.status === 'fulfilled' ? attendanceRes.value.data.totalElements : '—';
            const totalAreas = areasRes.status === 'fulfilled' ? areasRes.value.data.length : '—';
            const pendingApprovals =
                pendingRes.status === 'fulfilled' ? pendingRes.value.data.totalElements : '—';

            setStats([
                {
                    label: 'Total Users',
                    value: totalUsers,
                    icon: Users,
                    gradient: 'from-blue-500 to-blue-600',
                    shadowColor: 'shadow-blue-500/20',
                },
                {
                    label: 'Attendance Records',
                    value: totalAttendance,
                    icon: ClipboardList,
                    gradient: 'from-emerald-500 to-emerald-600',
                    shadowColor: 'shadow-emerald-500/20',
                },
                {
                    label: 'Office Areas',
                    value: totalAreas,
                    icon: MapPin,
                    gradient: 'from-violet-500 to-violet-600',
                    shadowColor: 'shadow-violet-500/20',
                },
                {
                    label: 'Pending Approvals',
                    value: pendingApprovals,
                    icon: ShieldCheck,
                    gradient: 'from-amber-500 to-amber-600',
                    shadowColor: 'shadow-amber-500/20',
                },
            ]);
        } catch {
            toast.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <PageLoader />;

    if (user?.role === 'QR_OPERATOR') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-lg mx-auto px-4">
                <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-accent-500 rounded-3xl flex items-center justify-center shadow-xl shadow-primary-500/20 mb-8 transform -rotate-6">
                    <QrCode className="text-white transform rotate-6" size={40} />
                </div>
                <h1 className="text-3xl font-bold text-surface-900 mb-3">Welcome, {user.name}</h1>
                <p className="text-surface-600 mb-8 leading-relaxed">
                    You are logged in as a QR Operator. As an operator, your primary duty is to display and manage the rolling QR codes for staff attendance.
                </p>
                <a
                    href="/qr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary w-full sm:w-auto px-8 py-3 rounded-xl text-lg flex items-center justify-center gap-3 shadow-lg shadow-primary-500/30 hover:shadow-primary-500/40 transform hover:-translate-y-0.5 transition-all"
                >
                    <QrCode size={24} />
                    Launch QR Screen
                </a>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-surface-900">Dashboard</h1>
                <p className="text-sm text-surface-500 mt-1">Overview of your attendance system</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {stats.map((stat) => (
                    <div key={stat.label} className="card p-5 flex items-center gap-4">
                        <div
                            className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg ${stat.shadowColor}`}
                        >
                            <stat.icon className="text-white" size={22} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-surface-900">{stat.value}</p>
                            <p className="text-sm text-surface-500">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick info */}
            <div className="mt-8 card p-6">
                <h2 className="text-lg font-semibold text-surface-900 mb-3">Quick Links</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <a
                        href="/admin/approvals"
                        className="flex items-center gap-3 p-4 rounded-xl bg-surface-50 hover:bg-surface-100 transition-colors group"
                    >
                        <ShieldCheck size={20} className="text-amber-500" />
                        <span className="text-sm font-medium text-surface-700 group-hover:text-surface-900">
                            Review pending approvals
                        </span>
                    </a>
                    <a
                        href="/admin/users"
                        className="flex items-center gap-3 p-4 rounded-xl bg-surface-50 hover:bg-surface-100 transition-colors group"
                    >
                        <Users size={20} className="text-blue-500" />
                        <span className="text-sm font-medium text-surface-700 group-hover:text-surface-900">
                            Manage users
                        </span>
                    </a>
                    <a
                        href="/admin/attendance"
                        className="flex items-center gap-3 p-4 rounded-xl bg-surface-50 hover:bg-surface-100 transition-colors group"
                    >
                        <ClipboardList size={20} className="text-emerald-500" />
                        <span className="text-sm font-medium text-surface-700 group-hover:text-surface-900">
                            View attendance records
                        </span>
                    </a>
                </div>
            </div>
        </div>
    );
}
