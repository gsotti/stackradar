import React, { useState, useEffect, FormEvent } from 'react';
import { Plus, Trash2, Edit2, RefreshCw, Users as UsersIcon, UserCheck, UserX, Clock, CheckCircle, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { getGravatarUrl } from '../utils/md5';
import { User } from '../types';

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '', global_role: null as string | null, auto_approve: true });
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '', global_role: null as string | null });

  const loadUsers = async () => {
    try {
      setLoading(true);
      const [allUsers, pending] = await Promise.all([
        api.get<User[]>('/admin/users'),
        api.get<User[]>('/admin/users/pending')
      ]);
      setUsers(allUsers);
      setPendingUsers(pending);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const approveUser = async (userId: number) => {
    try {
      await api.post(`/admin/users/${userId}/approve`, {});
      await loadUsers();
    } catch (error: any) {
      alert('Failed to approve user: ' + error.message);
    }
  };

  const deleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      await api.delete(`/admin/users/${userId}`);
      await loadUsers();
    } catch (error: any) {
      alert('Failed to delete user: ' + error.message);
    }
  };

  const toggleUserActive = async (userId: number, isActive: boolean) => {
    try {
      await api.post(`/admin/users/${userId}/${isActive ? 'deactivate' : 'activate'}`, {});
      await loadUsers();
    } catch (error: any) {
      alert(`Failed to ${isActive ? 'deactivate' : 'activate'} user: ` + error.message);
    }
  };

  const createUser = async (e: FormEvent) => {
    e.preventDefault();

    if (!newUser.email || !newUser.password) {
      alert('Email and password are required');
      return;
    }

    try {
      await api.post('/admin/users', {
        email: newUser.email,
        password: newUser.password,
        name: newUser.name || null,
        global_role: newUser.global_role || null,
        auto_approve: newUser.auto_approve
      });

      // Reset form and close modal
      setNewUser({ email: '', password: '', name: '', global_role: null, auto_approve: true });
      setShowCreateModal(false);
      await loadUsers();
    } catch (error: any) {
      alert('Failed to create user: ' + error.message);
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setEditForm({
      name: user.name || '',
      email: user.email,
      password: '',
      global_role: user.global_role
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const payload: any = {
        name: editForm.name || null,
        email: editForm.email,
        global_role: editForm.global_role
      };

      if (editForm.password) {
        payload.password = editForm.password;
      }

      await api.put(`/admin/users/${editingUser.id}`, payload);
      setShowEditModal(false);
      await loadUsers();
    } catch (error: any) {
      alert('Failed to update user: ' + error.message);
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-6rem)]">
        <RefreshCw className="w-10 h-10 animate-spin text-primary-500" />
      </div>
    );
  }

  const displayedUsers = activeTab === 'all' ? users : pendingUsers;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-2">User Management</h1>
          <p className="text-body-secondary mt-2">Manage platform users, roles, and approvals</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadUsers}
            className="p-2.5 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-all"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="button-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add User
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800/50 p-1 rounded-xl w-fit border border-neutral-200 dark:border-neutral-700">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'all'
              ? 'bg-white dark:bg-neutral-700 text-primary-600 dark:text-primary-400 shadow-sm border border-neutral-200 dark:border-neutral-600'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-300'
          }`}
        >
          <UsersIcon className="w-4 h-4" />
          All Users
          <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${activeTab === 'all' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'}`}>
            {users.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'pending'
              ? 'bg-white dark:bg-neutral-700 text-accent-warning dark:text-accent-warning shadow-sm border border-neutral-200 dark:border-neutral-600'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-300'
          }`}
        >
          <Clock className="w-4 h-4" />
          Pending Approval
          {pendingUsers.length > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-accent-warning text-white rounded-full text-[10px] font-medium animate-pulse">
              {pendingUsers.length}
            </span>
          )}
        </button>
      </div>

      {/* User Cards Grid */}
      {displayedUsers.length === 0 ? (
        <div className="text-center py-20 surface rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-700">
          <UsersIcon className="w-16 h-16 text-neutral-300 dark:text-neutral-600 mx-auto mb-4 opacity-50" />
          <h3 className="text-heading-4">No users found</h3>
          <p className="text-neutral-600 dark:text-neutral-400 max-w-sm mx-auto mt-2">
            {activeTab === 'pending' ? 'All user accounts have been approved.' : 'Start adding team members to your platform.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {displayedUsers.map((user) => (
            <div
              key={user.id}
              className={`group card-hover relative overflow-hidden ${!user.is_active ? 'opacity-60 grayscale' : ''}`}
            >
              {/* Background accent */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary-500/5 to-primary-500/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-150" />

              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {user.email && getGravatarUrl(user.email) ? (
                        <img
                          src={getGravatarUrl(user.email, 56)!}
                          alt={user.name || user.email}
                          className="w-12 h-12 rounded-lg shadow-md ring-2 ring-neutral-200 dark:ring-neutral-700"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-primary-600 to-primary-700 rounded-lg flex items-center justify-center shadow-md">
                          <span className="text-base font-bold text-white uppercase">{user.name?.[0] || user.email[0]}</span>
                        </div>
                      )}
                      {user.is_active && (
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-accent-success border-2 border-white dark:border-neutral-800 rounded-full" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-neutral-900 dark:text-white truncate">{user.name || 'Anonymous'}</h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    {user.global_role === 'superadmin' && (
                      <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-[10px] font-bold uppercase tracking-wider rounded-md border border-primary-200 dark:border-primary-800">
                        Superadmin
                      </span>
                    )}
                    {user.global_role === 'org_admin' && (
                      <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-[10px] font-bold uppercase tracking-wider rounded-md border border-primary-200 dark:border-primary-800">
                        Org Admin
                      </span>
                    )}
                  </div>
                </div>

                {!user.is_approved ? (
                  <div className="flex flex-col gap-2 mt-3">
                    <div className="p-2 bg-accent-warning/10 dark:bg-accent-warning/10 rounded-lg border border-accent-warning/20 dark:border-accent-warning/20 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-accent-warning flex-shrink-0" />
                      <span className="text-xs font-medium text-accent-warning">Waiting for approval</span>
                    </div>
                    <button
                      onClick={() => approveUser(user.id)}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-accent-success hover:bg-accent-success/90 text-white rounded-lg font-semibold text-sm transition-all"
                    >
                      <UserCheck className="w-4 h-4" />
                      Approve User
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <button
                      onClick={() => openEditModal(user)}
                      className="flex items-center justify-center gap-1 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-neutral-700 dark:text-neutral-300 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg transition-all font-semibold text-xs"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => toggleUserActive(user.id, user.is_active)}
                      className={`flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg transition-all font-semibold text-xs ${
                        user.is_active
                          ? 'bg-neutral-100 dark:bg-neutral-800 hover:bg-accent-warning/10 dark:hover:bg-accent-warning/10 text-neutral-700 dark:text-neutral-300 hover:text-accent-warning dark:hover:text-accent-warning'
                          : 'bg-accent-success/10 dark:bg-accent-success/10 text-accent-success hover:bg-accent-success hover:text-white'
                      }`}
                    >
                      {user.is_active ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                      {user.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => deleteUser(user.id)}
                      disabled={currentUser?.id === user.id}
                      className="flex items-center justify-center gap-1 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-accent-danger/10 dark:hover:bg-accent-danger/10 text-neutral-700 dark:text-neutral-300 hover:text-accent-danger dark:hover:text-accent-danger rounded-lg transition-all font-semibold text-xs disabled:hidden"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fadeIn">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="card relative w-full max-w-md">
            <div className="pb-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
              <h2 className="text-heading-3">Create New User</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            <form onSubmit={createUser} className="mt-4 space-y-4">
              <div>
                <label className="block text-label mb-2">Full Name</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="input-base w-full"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-label mb-2">Email Address *</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="input-base w-full"
                  placeholder="john@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-label mb-2">Password *</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="input-base w-full"
                  placeholder="••••••••"
                  required
                />
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-label mb-2">Global Role</label>
                  <select
                    value={newUser.global_role || ''}
                    onChange={(e) => setNewUser({ ...newUser, global_role: e.target.value || null })}
                    className="input-base w-full"
                  >
                    <option value="">No global role</option>
                    <option value="superadmin">Superadmin</option>
                    <option value="org_admin">Organization Admin</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={newUser.auto_approve}
                      onChange={(e) => setNewUser({ ...newUser, auto_approve: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-6 bg-neutral-300 dark:bg-neutral-700 rounded-full peer-checked:bg-accent-success peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                  </div>
                  <span className="text-body-secondary text-sm group-hover:text-accent-success transition-colors">Auto-approve account</span>
                </label>
              </div>
              <div className="pt-4 flex gap-2">
                <button
                  type="submit"
                  className="button-primary flex-1"
                >
                  Create Account
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="button-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fadeIn">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setShowEditModal(false)} />
          <div className="card relative w-full max-w-md">
            <div className="pb-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
              <h2 className="text-heading-3">Edit User</h2>
              <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-label mb-2">Full Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="input-base w-full"
                />
              </div>
              <div>
                <label className="block text-label mb-2">Email Address</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="input-base w-full"
                />
              </div>
              <div>
                <label className="block text-label mb-2">
                  New Password
                  <span className="ml-2 font-normal text-body-secondary text-xs">(leave blank to keep current)</span>
                </label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="input-base w-full"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-label mb-2">Global Role</label>
                <select
                  value={editForm.global_role || ''}
                  onChange={(e) => setEditForm({ ...editForm, global_role: e.target.value || null })}
                  className="input-base w-full"
                >
                  <option value="">No global role</option>
                  <option value="superadmin">Superadmin</option>
                  <option value="org_admin">Organization Admin</option>
                </select>
              </div>
              <div className="pt-4 flex gap-2">
                <button
                  type="submit"
                  className="button-primary flex-1"
                >
                  Update Details
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="button-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
