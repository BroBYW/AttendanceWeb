import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, LogIn, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim() || !password.trim()) {
            toast.error('Please enter both username and password');
            return;
        }
        setLoading(true);
        try {
            await login(username, password);
            toast.success('Login successful!');
            // We now send both ADMIN and QR_OPERATOR to /admin
            navigate('/admin', { replace: true });
        } catch (err: unknown) {
            const msg =
                err instanceof Error
                    ? err.message
                    : 'Invalid credentials. Please try again.';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary-900 via-primary-800 to-surface-900" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--color-accent-600)_0%,_transparent_50%)] opacity-30" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--color-primary-500)_0%,_transparent_50%)] opacity-20" />

            {/* Decorative floating shapes */}
            <div className="absolute top-20 left-10 w-72 h-72 bg-primary-400/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl animate-pulse" />

            {/* Login Card */}
            <div className="relative z-10 w-full max-w-md mx-4">
                <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl p-8 shadow-2xl">
                    {/* Logo */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-primary-400 to-accent-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-primary-500/30">
                            <Building2 className="text-white" size={32} />
                        </div>
                        <h1 className="text-2xl font-bold text-white">AttendanceWeb</h1>
                        <p className="text-white/60 text-sm mt-1">Admin Dashboard</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Username */}
                        <div>
                            <label className="block text-sm font-medium text-white/80 mb-1.5">
                                Username
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter your username"
                                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40
                           focus:outline-none focus:ring-2 focus:ring-primary-400/50 focus:border-primary-400/50 transition-all"
                                autoFocus
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium text-white/80 mb-1.5">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40
                             focus:outline-none focus:ring-2 focus:ring-primary-400/50 focus:border-primary-400/50 transition-all pr-12"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors cursor-pointer"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 text-white font-semibold
                         hover:from-primary-600 hover:to-accent-600 transition-all duration-300 shadow-lg shadow-primary-500/30
                         hover:shadow-xl hover:shadow-primary-500/40 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                        >
                            {loading ? (
                                <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <LogIn size={20} />
                                    Sign In
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center text-white/30 text-xs mt-6">
                    © 2026 AttendanceServer • Admin Panel
                </p>
            </div>
        </div>
    );
}
