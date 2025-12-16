import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, RefreshCw, Users, UserCheck, UserX, Clock, CheckCircle, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { getGravatarUrl } from '../utils/md5';

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '', is_admin: false, auto_approve: true });
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '', is_admin: false });

  const loadUsers = async () => {
    try {
      setLoading(true);
      const [allUsers, pending] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/users/pending')
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

  const approveUser = async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/approve`);
      await loadUsers();
    } catch (error) {
      alert('Failed to approve user: ' + error.message);
    }
  };

  const deleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      await api.delete(`/admin/users/${userId}`);
      await loadUsers();
    } catch (error) {
      alert('Failed to delete user: ' + error.message);
    }
  };

  const toggleUserActive = async (userId, isActive) => {
    try {
      await api.post(`/admin/users/${userId}/${isActive ? 'deactivate' : 'activate'}`);
      await loadUsers();
    } catch (error) {
      alert(`Failed to ${isActive ? 'deactivate' : 'activate'} user: ` + error.message);
    }
  };

  const createUser = async (e) => {
    e.preventDefault();

    if (!newUser.email || !newUser.password) {
      alert('Email and password are required');
      return;
    }

    try {
      // Register the user
      await api.post('/auth/register', {
        email: newUser.email,
        password: newUser.password,
        name: newUser.name || null
      });

      // If auto-approve is enabled, get the user and approve them
      if (newUser.auto_approve) {
        const allUsers = await api.get('/admin/users');
        const createdUser = allUsers.find(u => u.email === newUser.email);
        if (createdUser && !createdUser.is_approved) {
          await api.post(`/admin/users/${createdUser.id}/approve`);
        }
      }

      // Reset form and close modal
      setNewUser({ email: '', password: '', name: '', is_admin: false, auto_approve: true });
      setShowCreateModal(false);
      await loadUsers();
    } catch (error) {
      alert('Failed to create user: ' + error.message);
    }
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setEditForm({
      name: user.name || '',
      email: user.email,
      password: '',
      is_admin: user.is_admin
    });
    setShowEditModal(true);
  };

  const updateUser = async (e) => {
    e.preventDefault();

    try {
      const updateData = {
        name: editForm.name,
        email: editForm.email,
        is_admin: editForm.is_admin
      };

      // Only include password if it's been changed
      if (editForm.password && editForm.password.length > 0) {
        updateData.password = editForm.password;
      }

      await api.put(`/admin/users/${editingUser.id}`, updateData);

      // Reset form and close modal
      setEditForm({ name: '', email: '', password: '', is_admin: false });
      setEditingUser(null);
      setShowEditModal(false);
      await loadUsers();
    } catch (error) {
      alert('Failed to update user: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Check if current user is admin
  if (!currentUser?.is_admin) {
    return (
      <div className="text-center py-12">
        <Users className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">Admin Access Required</h2>
        <p className="text-gray-400">You need administrator privileges to access this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">User Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage user accounts and permissions</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2 font-medium"
          >
            <Plus className="w-4 h-4" />
            Create User
          </button>
          <button
            onClick={loadUsers}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-all shadow-sm hover:shadow-md font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="group relative bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-white/20 backdrop-blur-sm rounded-xl group-hover:scale-110 transition-transform">
                <Users className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-blue-100 text-sm font-medium mb-1">Total Users</p>
                <p className="text-4xl font-bold text-white">{users.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="group relative bg-gradient-to-br from-yellow-500 to-orange-600 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-white/20 backdrop-blur-sm rounded-xl group-hover:scale-110 transition-transform">
                <Clock className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-yellow-100 text-sm font-medium mb-1">Pending Approval</p>
                <p className="text-4xl font-bold text-white">{pendingUsers.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="group relative bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-white/20 backdrop-blur-sm rounded-xl group-hover:scale-110 transition-transform">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-green-100 text-sm font-medium mb-1">Active Users</p>
                <p className="text-4xl font-bold text-white">
                  {users.filter(u => u.is_active && u.is_approved).length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800">
          <div className="flex">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-6 py-4 font-semibold transition-all ${
                activeTab === 'all'
                  ? 'border-b-3 border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-800/50'
              }`}
            >
              All Users ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-6 py-4 font-semibold transition-all ${
                activeTab === 'pending'
                  ? 'border-b-3 border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-800/50'
              }`}
            >
              Pending Approval ({pendingUsers.length})
            </button>
          </div>
        </div>

        {/* User List */}
        <div className="p-6">
          {activeTab === 'pending' && pendingUsers.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No pending users</p>
            </div>
          )}

          {activeTab === 'all' && users.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No users found</p>
            </div>
          )}

          <div className="space-y-4">
            {(activeTab === 'pending' ? pendingUsers : users).map((user) => (
              <div
                key={user.id}
                className="group flex items-center justify-between p-5 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 hover:shadow-lg transition-all duration-300 hover:scale-[1.01]"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                    {user.email && getGravatarUrl(user.email) ? (
                      <img
                        src={getGravatarUrl(user.email, 48)}
                        alt={user.name || user.email}
                        className="w-12 h-12 rounded-full ring-2 ring-gray-200 dark:ring-gray-600 group-hover:ring-blue-500 transition-all"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center ring-2 ring-gray-200 dark:ring-gray-600 group-hover:ring-blue-500 transition-all shadow-lg">
                        <span className="font-bold text-white text-lg">
                          {user.name?.[0] || user.email[0]}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{user.name || 'Unnamed User'}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Status Badges */}
                  {user.is_admin && (
                    <span className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-xs font-semibold rounded-lg shadow-md">
                      Admin
                    </span>
                  )}
                  {user.is_approved ? (
                    <span className="px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-semibold rounded-lg shadow-md">
                      Approved
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs font-semibold rounded-lg shadow-md animate-pulse">
                      Pending
                    </span>
                  )}
                  {user.is_active ? (
                    <span className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-semibold rounded-lg shadow-md">
                      Active
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-lg">
                      Inactive
                    </span>
                  )}

                  {/* Actions */}
                  {!user.is_approved && (
                    <button
                      onClick={() => approveUser(user.id)}
                      className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-sm rounded-xl flex items-center gap-2 shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 font-medium"
                    >
                      <UserCheck className="w-4 h-4" />
                      Approve
                    </button>
                  )}

                  {user.is_approved && (
                    <button
                      onClick={() => toggleUserActive(user.id, user.is_active)}
                      className={`px-4 py-2 text-sm rounded-xl flex items-center gap-2 shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 font-medium ${
                        user.is_active
                          ? 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white'
                          : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
                      }`}
                    >
                      {user.is_active ? (
                        <>
                          <UserX className="w-4 h-4" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-4 h-4" />
                          Activate
                        </>
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => openEditModal(user)}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm rounded-xl flex items-center gap-2 shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 font-medium"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>

                  <button
                    onClick={() => deleteUser(user.id)}
                    className="px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-sm rounded-xl flex items-center gap-2 shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Create New User</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-600 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={createUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="user@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password *
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter password"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name (Optional)
                </label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto-approve"
                  checked={newUser.auto_approve}
                  onChange={(e) => setNewUser({ ...newUser, auto_approve: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="auto-approve" className="text-sm text-gray-300">
                  Auto-approve user (recommended)
                </label>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Edit User</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingUser(null);
                }}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={updateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="user@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name (Optional)
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New Password (Leave empty to keep current)
                </label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter new password"
                  minLength={6}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-is-admin"
                  checked={editForm.is_admin}
                  onChange={(e) => setEditForm({ ...editForm, is_admin: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="edit-is-admin" className="text-sm text-gray-300">
                  Administrator privileges
                </label>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Update User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
