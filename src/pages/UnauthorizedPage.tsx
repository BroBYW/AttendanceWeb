import { useNavigate } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';

export default function UnauthorizedPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex items-center justify-center bg-surface-50">
            <div className="text-center px-4">
                <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
                    <ShieldOff size={40} className="text-danger-500" />
                </div>
                <h1 className="text-3xl font-bold text-surface-900 mb-2">Access Denied</h1>
                <p className="text-surface-500 mb-6 max-w-sm mx-auto">
                    You don't have permission to access this page. Contact your administrator for access.
                </p>
                <button onClick={() => navigate('/login', { replace: true })} className="btn-primary">
                    Back to Login
                </button>
            </div>
        </div>
    );
}
