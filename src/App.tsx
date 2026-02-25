import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import RoleRoute from './components/RoleRoute';
import AdminLayout from './layouts/AdminLayout';
import LoginPage from './pages/LoginPage';
import QRDisplayPage from './pages/QRDisplayPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import OfficeAreasPage from './pages/OfficeAreasPage';
import AttendancePage from './pages/AttendancePage';
import ApprovalPage from './pages/ApprovalPage';
import UnauthorizedPage from './pages/UnauthorizedPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* QR Operator */}
          <Route
            path="/qr"
            element={
              <RoleRoute allowed={['QR_OPERATOR', 'ADMIN']}>
                <QRDisplayPage />
              </RoleRoute>
            }
          />

          {/* Admin */}
          <Route
            path="/admin"
            element={
              <RoleRoute allowed={['ADMIN', 'QR_OPERATOR']}>
                <AdminLayout />
              </RoleRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="users" element={<RoleRoute allowed={['ADMIN']}><UsersPage /></RoleRoute>} />
            <Route path="office-areas" element={<RoleRoute allowed={['ADMIN']}><OfficeAreasPage /></RoleRoute>} />
            <Route path="attendance" element={<RoleRoute allowed={['ADMIN']}><AttendancePage /></RoleRoute>} />
            <Route path="approvals" element={<RoleRoute allowed={['ADMIN']}><ApprovalPage /></RoleRoute>} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: '12px',
            background: '#1e293b',
            color: '#f8fafc',
            fontSize: '14px',
          },
        }}
      />
    </AuthProvider>
  );
}
