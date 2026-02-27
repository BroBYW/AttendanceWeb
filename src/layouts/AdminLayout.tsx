import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    LayoutDashboard,
    Users,
    MapPin,
    ClipboardList,
    ShieldCheck,
    LogOut,
    Menu,
    X,
    ChevronRight,
} from 'lucide-react';
import logo from '../assets/images.png';
import clsx from 'clsx';

const navItems = [
    { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/office-areas', label: 'Office Areas', icon: MapPin },
    { to: '/admin/attendance', label: 'Attendance', icon: ClipboardList },
    { to: '/admin/approvals', label: 'Approvals', icon: ShieldCheck },
];

export default function AdminLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    return (
        <div className="flex h-screen bg-surface-50">
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-surface-950/40 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={clsx(
                    'fixed lg:static inset-y-0 left-0 z-50 w-72 bg-white border-r border-surface-200/60 flex flex-col transition-transform duration-300 lg:translate-x-0',
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full',
                )}
            >
                {/* Brand */}
                <div className="flex items-center gap-3 px-6 h-16 border-b border-surface-100 shrink-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md shadow-primary-500/20 overflow-hidden">
                        <img src={logo} alt="Logo" className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-surface-900 leading-tight">AttendanceWeb</h1>
                        <p className="text-[10px] text-surface-400 uppercase tracking-widest">Admin Panel</p>
                    </div>
                    {/* Close for mobile */}
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden ml-auto p-1 rounded-lg text-surface-400 hover:bg-surface-100 cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                    {user?.role === 'ADMIN' && navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={() => setSidebarOpen(false)}
                            className={({ isActive }) =>
                                clsx(
                                    'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                                    isActive
                                        ? 'bg-primary-50 text-primary-700 shadow-sm shadow-primary-100'
                                        : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900',
                                )
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <item.icon
                                        size={20}
                                        className={clsx(
                                            'shrink-0 transition-colors',
                                            isActive ? 'text-primary-600' : 'text-surface-400 group-hover:text-surface-600',
                                        )}
                                    />
                                    <span className="flex-1">{item.label}</span>
                                    {isActive && (
                                        <ChevronRight size={16} className="text-primary-400" />
                                    )}
                                </>
                            )}
                        </NavLink>
                    ))}

                </nav>

                {/* User info + logout */}
                <div className="p-4 border-t border-surface-100 shrink-0">
                    <div className="flex items-center gap-3 px-3 py-2">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white font-semibold text-sm shadow-md">
                            {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-surface-900 truncate">{user?.name}</p>
                            <p className="text-xs text-surface-400 truncate">{user?.role?.replace(/_/g, ' ')}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="mt-2 w-full btn-ghost text-danger-500 hover:bg-red-50 hover:text-danger-600 text-sm"
                    >
                        <LogOut size={18} />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Top bar */}
                <header className="h-16 bg-white border-b border-surface-200/60 flex items-center px-4 lg:px-6 gap-4 shrink-0">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="lg:hidden p-2 rounded-lg text-surface-500 hover:bg-surface-100 cursor-pointer"
                    >
                        <Menu size={22} />
                    </button>
                    <div className="flex-1" />
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-surface-500 hidden sm:inline">
                            Welcome, <span className="font-semibold text-surface-700">{user?.name}</span>
                        </span>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
