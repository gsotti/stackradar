import React, { useState, useEffect, FormEvent } from 'react';
import { Globe, Plus, Edit2, Trash2, LayoutGrid, List } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotification } from '../contexts/NotificationContext';
import { useApp } from '../contexts/AppContext';
import { api } from '../utils/api';
import { Environment, Site } from '../types';
import ConfirmDialog from '../components/common/ConfirmDialog';

interface EnvironmentWithDetails extends Environment {
  site_name?: string;
  tenant_name?: string;
}

export default function EnvironmentsPage() {
  const { t } = useTranslation('environments');
  const { t: tc } = useTranslation('common');
  const [environments, setEnvironments] = useState<EnvironmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEnv, setEditingEnv] = useState<EnvironmentWithDetails | null>(null);
  const [form, setForm] = useState({ site_id: '', name: '', display_name: '' });
  const [sites, setSites] = useState<Site[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<EnvironmentWithDetails | null>(null);
  const { showError, showSuccess } = useNotification();
  const { selectedTenant } = useApp();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() =>
    (localStorage.getItem('viewMode_environments') as 'grid' | 'list') || 'grid'
  );

  const toggleView = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('viewMode_environments', mode);
  };

  useEffect(() => {
    loadEnvironments();
    loadSites();
  }, [selectedTenant]);

  const loadSites = async () => {
    try {
      const data = await api.get<Site[]>('/sites');
      setSites(data);
    } catch (error: any) {
      showError(error.message || t('messages.load_sites_failed'));
    }
  };

  const loadEnvironments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedTenant) params.append('tenant_id', selectedTenant);
      const data = await api.get<EnvironmentWithDetails[]>(`/environments?${params}`);
      setEnvironments(data);
    } catch (error: any) {
      showError(error.message || t('messages.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingEnv) {
        await api.put(`/environments/${editingEnv.id}`, { name: form.name, display_name: form.display_name || null });
        showSuccess(t('messages.updated'));
      } else {
        await api.post('/environments', form);
        showSuccess(t('messages.created'));
      }
      setShowForm(false);
      setEditingEnv(null);
      setForm({ site_id: '', name: '', display_name: '' });
      loadEnvironments();
    } catch (error: any) {
      showError(error.message || t('messages.save_failed'));
    }
  };

  const handleEdit = (env: EnvironmentWithDetails) => {
    setEditingEnv(env);
    setForm({ site_id: String(env.site_id), name: env.name, display_name: env.display_name || '' });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/environments/${id}`);
      showSuccess(t('messages.deleted'));
      loadEnvironments();
    } catch (error: any) {
      showError(error.message || t('messages.delete_failed'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-6rem)]">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-heading-2">{t('page.title')}</h1>
          <p className="text-body-secondary mt-2">{t('page.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1 gap-0.5">
            <button
              onClick={() => toggleView('grid')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-neutral-700 shadow-sm text-primary-600 dark:text-primary-400' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => toggleView('list')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-neutral-700 shadow-sm text-primary-600 dark:text-primary-400' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => { setEditingEnv(null); setForm({ site_id: '', name: '', display_name: '' }); setShowForm(true); }}
            className="button-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('actions.create')}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="card w-full max-w-md">
            <h2 className="text-heading-3 mb-6">
              {editingEnv ? t('form.title_edit') : t('form.title_create')}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingEnv && (
                <div>
                  <label className="block text-label mb-2">{t('form.site_label')}</label>
                  <select
                    value={form.site_id}
                    onChange={(e) => setForm({ ...form, site_id: e.target.value })}
                    className="input-base w-full"
                    required
                  >
                    <option value="">{t('form.site_placeholder')}</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>{site.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-label mb-2">{t('form.name_label')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input-base w-full"
                  placeholder={t('form.name_placeholder')}
                  required
                />
              </div>
              <div>
                <label className="block text-label mb-2">{t('form.display_name_label')}</label>
                <input
                  type="text"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  className="input-base w-full"
                  placeholder={t('form.display_name_placeholder')}
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => { setShowForm(false); setEditingEnv(null); }} className="button-secondary button-center">
                  {t('form.cancel')}
                </button>
                <button type="submit" className="button-primary button-center">
                  {editingEnv ? t('form.submit_save') : t('form.submit_create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {environments.length === 0 ? (
        <div className="text-center py-12 surface rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-700">
          <Globe className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-4" />
          <p className="text-neutral-500 dark:text-neutral-400">{t('empty.title')} {t('empty.description')}</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {environments.map((env) => (
            <div key={env.id} className="card-hover group">
              <div className="flex justify-between items-start mb-3">
                <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg group-hover:scale-110 transition-transform">
                  <Globe className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(env)} className="p-1.5 text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setDeleteTarget(env)} className="p-1.5 text-neutral-400 hover:text-accent-danger transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div>
                <h3 className="text-heading-4 truncate text-neutral-900 dark:text-white">
                  {env.display_name || env.name}
                </h3>
                <p className="text-body-secondary text-xs">ID: {env.name}</p>
                <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700/50 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-label text-xs">{t('card.site_label')}</span>
                    <span className="text-body text-sm truncate">{env.site_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-label text-xs">{t('card.tenant_label')}</span>
                    <span className="text-body text-sm truncate">{env.tenant_name}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {environments.map((env) => (
            <div key={env.id} className="card-hover group flex items-center gap-4 py-3 px-4">
              <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg flex-shrink-0 group-hover:scale-110 transition-transform">
                <Globe className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                  {env.display_name || env.name}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">ID: {env.name}</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400 flex-shrink-0">
                <span className="hidden sm:flex items-center gap-1">
                  <span className="text-label">{t('card.site_label')}</span>
                  <span className="text-neutral-700 dark:text-neutral-300">{env.site_name}</span>
                </span>
                <span className="hidden md:flex items-center gap-1">
                  <span className="text-label">{t('card.tenant_label')}</span>
                  <span className="text-neutral-700 dark:text-neutral-300">{env.tenant_name}</span>
                </span>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => handleEdit(env)} className="p-1.5 text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setDeleteTarget(env)} className="p-1.5 text-neutral-400 hover:text-accent-danger transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t('confirm.delete_title')}
        description={tc('confirm_dialog.cannot_be_undone')}
        confirmLabel={t('confirm.delete_label')}
        variant="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          handleDelete(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
