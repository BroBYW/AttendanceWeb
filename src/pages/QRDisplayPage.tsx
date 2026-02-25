import { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { qrService } from '../services/qrService';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { QrCode, Clock, LogOut, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function QRDisplayPage() {
    const [token, setToken] = useState<string | null>(null);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const [isPastCutoff, setIsPastCutoff] = useState(false);
    const [loading, setLoading] = useState(false);
    const intervalRef = useRef<number | null>(null);
    const countdownRef = useRef<number | null>(null);
    const { logout } = useAuth();
    const navigate = useNavigate();

    const QR_DURATION = 30; // seconds
    const CUTOFF_HOUR = 7; // 07:00

    // Check if past cutoff time
    const checkCutoff = useCallback(() => {
        const now = new Date();
        const hour = now.getHours();
        if (hour >= CUTOFF_HOUR) {
            setIsPastCutoff(true);
            stopAutoRefresh();
            return true;
        }
        return false;
    }, []);

    useEffect(() => {
        checkCutoff();
        const check = setInterval(checkCutoff, 30000);
        return () => clearInterval(check);
    }, [checkCutoff]);

    const generateQR = async () => {
        if (checkCutoff()) return;
        setLoading(true);
        try {
            const res = await qrService.generate();
            if (res.success) {
                setToken(res.data.token);
                setSecondsLeft(QR_DURATION);
            } else {
                toast.error(res.message || 'Failed to generate QR');
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to generate QR';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const startAutoRefresh = async () => {
        if (checkCutoff()) return;
        setIsActive(true);
        await generateQR();

        // Auto refresh every 30 seconds
        intervalRef.current = window.setInterval(async () => {
            if (checkCutoff()) return;
            await generateQR();
        }, QR_DURATION * 1000);
    };

    const stopAutoRefresh = () => {
        setIsActive(false);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
        }
    };

    // Countdown timer
    useEffect(() => {
        if (secondsLeft > 0) {
            countdownRef.current = window.setInterval(() => {
                setSecondsLeft((prev) => {
                    if (prev <= 1) {
                        if (countdownRef.current) clearInterval(countdownRef.current);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, [token]);

    useEffect(() => {
        return () => {
            stopAutoRefresh();
        };
    }, []);

    const handleLogout = () => {
        stopAutoRefresh();
        logout();
        navigate('/login', { replace: true });
    };

    const progress = secondsLeft / QR_DURATION;
    const circumference = 2 * Math.PI * 54;
    const strokeDashoffset = circumference * (1 - progress);

    return (
        <div className="min-h-screen bg-gradient-to-br from-surface-900 via-surface-800 to-primary-900 flex flex-col items-center justify-center relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-500/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent-500/5 rounded-full blur-3xl" />

            {/* Logout button */}
            <button
                onClick={handleLogout}
                className="absolute top-4 right-4 p-2.5 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-all cursor-pointer"
            >
                <LogOut size={20} />
            </button>

            {/* Main content */}
            <div className="relative z-10 flex flex-col items-center gap-8 px-4">
                {/* Header */}
                <div className="text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 text-white/80 text-sm mb-4">
                        <QrCode size={16} />
                        QR Attendance Station
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-white">
                        Employee Clock-In
                    </h1>
                    <p className="text-white/50 text-sm mt-2">Scan QR code to mark attendance</p>
                </div>

                {isPastCutoff ? (
                    /* Cutoff message */
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-8 text-center max-w-md">
                        <AlertTriangle className="mx-auto text-amber-400 mb-4" size={48} />
                        <h2 className="text-xl font-bold text-amber-300 mb-2">QR Closed</h2>
                        <p className="text-amber-200/80 text-sm">
                            Normal clock-in period has ended (after 07:00).
                            <br />
                            Late clock-in only.
                        </p>
                    </div>
                ) : token && isActive ? (
                    /* QR Display */
                    <div className="flex flex-col items-center gap-6">
                        <div className="relative">
                            {/* Pulsing ring behind QR */}
                            <div className="absolute inset-0 -m-4 bg-white/5 rounded-3xl animate-pulse-ring" />

                            <div className="bg-white p-6 rounded-3xl shadow-2xl shadow-primary-500/10">
                                <QRCodeSVG
                                    value={token}
                                    size={280}
                                    level="H"
                                    includeMargin={false}
                                    bgColor="#ffffff"
                                    fgColor="#0f172a"
                                />
                            </div>
                        </div>

                        {/* Countdown */}
                        <div className="flex items-center gap-4">
                            <div className="relative w-16 h-16">
                                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 120 120">
                                    <circle
                                        cx="60"
                                        cy="60"
                                        r="54"
                                        stroke="rgba(255,255,255,0.1)"
                                        strokeWidth="6"
                                        fill="none"
                                    />
                                    <circle
                                        cx="60"
                                        cy="60"
                                        r="54"
                                        stroke={secondsLeft > 10 ? '#3b82f6' : '#ef4444'}
                                        strokeWidth="6"
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeDasharray={circumference}
                                        strokeDashoffset={strokeDashoffset}
                                        className="transition-all duration-1000 ease-linear"
                                    />
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-white">
                                    {secondsLeft}
                                </span>
                            </div>
                            <div>
                                <p className="text-white/70 text-sm">Auto-refresh in</p>
                                <p className="text-white font-semibold">{secondsLeft} seconds</p>
                            </div>
                        </div>

                        <button
                            onClick={stopAutoRefresh}
                            className="btn-ghost text-white/60 hover:text-white hover:bg-white/10"
                        >
                            Stop QR
                        </button>
                    </div>
                ) : (
                    /* Start button */
                    <div className="flex flex-col items-center gap-4">
                        <button
                            onClick={startAutoRefresh}
                            disabled={loading}
                            className="group relative px-10 py-5 rounded-2xl bg-gradient-to-r from-primary-500 to-accent-500 text-white font-bold text-lg
                         hover:from-primary-600 hover:to-accent-600 transition-all duration-300 shadow-2xl shadow-primary-500/30
                         hover:shadow-primary-500/50 hover:scale-105 disabled:opacity-50 cursor-pointer"
                        >
                            {loading ? (
                                <span className="inline-block w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <span className="flex items-center gap-3">
                                    <QrCode size={28} />
                                    Start QR
                                </span>
                            )}
                        </button>
                        <p className="text-white/40 text-sm flex items-center gap-1.5">
                            <Clock size={14} />
                            Active until 07:00
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
