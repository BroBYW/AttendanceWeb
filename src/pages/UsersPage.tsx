import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, UserX } from 'lucide-react';
import { userService } from '../services/userService';
import type { UserResponse, CreateUserRequest, UpdateUserRequest, Role } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import { PageLoader } from '../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

const ROLES: Role[] = ['ADMIN', 'QR_OPERATOR', 'OFFICE_STAFF', 'FIELD_STAFF'];

export default function UsersPage() {
    const [users, setUsers] = useState<UserResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editUser, setEditUser] = useState<UserResponse | null>(null);
    const [deactivateTarget, setDeactivateTarget] = useState<UserResponse | null>(null);
    const [reactivateTarget, setReactivateTarget] = useState<UserResponse | null>(null);
    const [saving, setSaving] = useState(false);

    // Form state
    const [form, setForm] = useState<CreateUserRequest & { id?: number }>({
        username: '',
        name: '',
        password: '',
        department: '',
        role: 'OFFICE_STAFF',
    });

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            const res = await userService.getAll();
            if (res.success) setUsers(res.data);
        } catch {
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const openCreate = () => {
        setEditUser(null);
        setForm({ username: '', name: '', password: '', department: '', role: 'OFFICE_STAFF' });
        setShowModal(true);
    };

    const openEdit = (user: UserResponse) => {
        setEditUser(user);
        setForm({
            username: user.username,
            name: user.name,
            password: '',
            department: user.department || '',
            role: user.role,
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (editUser) {
                const payload: UpdateUserRequest = {
                    name: form.name,
                    department: form.department || undefined,
                    role: form.role,
                };
                if (form.password) payload.password = form.password;
                await userService.update(editUser.id, payload);
                toast.success('User updated');
            } else {
                if (!form.password) {
                    toast.error('Password is required');
                    setSaving(false);
                    return;
                }
                await userService.create(form);
                toast.success('User created');
            }
            setShowModal(false);
            loadUsers();
        } catch {
            toast.error('Failed to save user');
        } finally {
            setSaving(false);
        }
    };

    const handleDeactivate = async () => {
        if (!deactivateTarget) return;
        setSaving(true);
        try {
            await userService.deactivate(deactivateTarget.id);
            toast.success('User deactivated');
            setDeactivateTarget(null);
            loadUsers();
        } catch {
            toast.error('Failed to deactivate user');
        } finally {
            setSaving(false);
        }
    };

    const handleReactivate = async () => {
        if (!reactivateTarget) return;
        setSaving(true);
        try {
            await userService.reactivate(reactivateTarget.id);
            toast.success('User reactivated');
            setReactivateTarget(null);
            loadUsers();
        } catch {
            toast.error('Failed to reactivate user');
        } finally {
            setSaving(false);
        }
    };

    const filtered = users.filter(
        (u) =>
            u.name.toLowerCase().includes(search.toLowerCase()) ||
            u.username.toLowerCase().includes(search.toLowerCase()) ||
            u.employeeId.toLowerCase().includes(search.toLowerCase()),
    );

    if (loading) return <PageLoader />;

    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900">Users</h1>
                    <p className="text-sm text-surface-500 mt-1">{users.length} total users</p>
                </div>
                <button onClick={openCreate} className="btn-primary">
                    <Plus size={18} />
                    Add User
                </button>
            </div>

            {/* Search */}
            <div className="card p-4 mb-4">
                <div className="relative max-w-sm">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                    <input
                        type="text"
                        placeholder="Search by name, username, or ID..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="input pl-10"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="card table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Employee ID</th>
                            <th>Name</th>
                            <th>Username</th>
                            <th>Department</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="text-center py-8 text-surface-400">
                                    No users found
                                </td>
                            </tr>
                        ) : (
                            filtered.map((user) => (
                                <tr key={user.id}>
                                    <td className="font-mono text-xs">{user.employeeId}</td>
                                    <td className="font-medium text-surface-900">{user.name}</td>
                                    <td>{user.username}</td>
                                    <td>{user.department || '—'}</td>
                                    <td><StatusBadge status={user.role} /></td>
                                    <td><StatusBadge status={user.status} /></td>
                                    <td>
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => openEdit(user)}
                                                className="btn-ghost btn-sm"
                                                title="Edit"
                                            >
                                                <Edit2 size={15} />
                                            </button>
                                            {user.status === 'ACTIVE' ? (
                                                <button
                                                    onClick={() => setDeactivateTarget(user)}
                                                    className="btn-ghost btn-sm text-danger-500 hover:text-danger-600"
                                                    title="Deactivate"
                                                >
                                                    <UserX size={15} />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => setReactivateTarget(user)}
                                                    className="btn-ghost btn-sm text-success-500 hover:text-success-600"
                                                    title="Reactivate"
                                                >
                                                    <Plus size={15} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create / Edit Modal */}
            <Modal
                open={showModal}
                onClose={() => setShowModal(false)}
                title={editUser ? 'Edit User' : 'Create User'}
            >
                <div className="space-y-4">
                    {!editUser && (
                        <div>
                            <label className="label">Username</label>
                            <input
                                className="input"
                                value={form.username}
                                onChange={(e) => setForm({ ...form, username: e.target.value })}
                                placeholder="e.g. john.doe"
                            />
                        </div>
                    )}
                    <div>
                        <label className="label">Full Name</label>
                        <input
                            className="input"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="e.g. John Doe"
                        />
                    </div>
                    <div>
                        <label className="label">{editUser ? 'New Password (leave blank to keep)' : 'Password'}</label>
                        <input
                            className="input"
                            type="password"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            placeholder={editUser ? '••••••' : 'Min 6 characters'}
                        />
                    </div>
                    <div>
                        <label className="label">Department</label>
                        <input
                            className="input"
                            value={form.department}
                            onChange={(e) => setForm({ ...form, department: e.target.value })}
                            placeholder="e.g. Engineering"
                        />
                    </div>
                    <div>
                        <label className="label">Role</label>
                        <select
                            className="select"
                            value={form.role}
                            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                        >
                            {ROLES.map((r) => (
                                <option key={r} value={r}>
                                    {r.replace(/_/g, ' ')}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex gap-3 justify-end pt-4">
                        <button onClick={() => setShowModal(false)} className="btn-secondary">
                            Cancel
                        </button>
                        <button onClick={handleSave} className="btn-primary" disabled={saving}>
                            {saving ? 'Saving...' : editUser ? 'Update' : 'Create'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Deactivate confirm */}
            <ConfirmModal
                open={!!deactivateTarget}
                onClose={() => setDeactivateTarget(null)}
                onConfirm={handleDeactivate}
                title="Deactivate User"
                message={`Are you sure you want to deactivate "${deactivateTarget?.name}"? They will no longer be able to log in.`}
                confirmText="Deactivate"
                variant="danger"
                loading={saving}
            />

            {/* Reactivate confirm */}
            <ConfirmModal
                open={!!reactivateTarget}
                onClose={() => setReactivateTarget(null)}
                onConfirm={handleReactivate}
                title="Reactivate User"
                message={`Are you sure you want to reactivate "${reactivateTarget?.name}"? They will regain access to the system.`}
                confirmText="Reactivate"
                variant="success"
                loading={saving}
            />
        </div>
    );
}
