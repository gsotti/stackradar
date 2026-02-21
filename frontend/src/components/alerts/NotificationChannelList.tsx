import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Mail, Webhook, Power, Zap, AlertTriangle } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import { usePermissions } from '../../hooks/usePermissions';
import { api } from '../../utils/api';
import NotificationChannelForm from './NotificationChannelForm';
import { NotificationChannel } from '../../types';
import ConfirmDialog from '../common/ConfirmDialog';

interface NotificationChannelListProps {
  siteId: string | number;
}

export default function NotificationChannelList({ siteId }: NotificationChannelListProps) {
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null);
  const [testingChannelId, setTestingChannelId] = useState<number | null>(null);
  const [smtpConfigured, setSmtpConfigured] = useState<boolean | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NotificationChannel | null>(null);
  const smtpLoaded = smtpConfigured !== null;
  const { showError, showSuccess, showInfo } = useNotification();
  const { isViewer } = usePermissions();

  useEffect(() => {
    loadChannels();
    checkSmtpConfig();
  }, [siteId]);

  const checkSmtpConfig = async () => {
    try {
      const config = await api.get('/alerts/smtp-config');
      setSmtpConfigured(!!config);
    } catch {
      setSmtpConfigured(false);
    }
  };

  const loadChannels = async () => {
    try {
      setLoading(true);
      const data = await api.get<NotificationChannel[]>(`/alerts/channels?site_id=${siteId}`);
      setChannels(data);
    } catch (error: any) {
      showError(error.message || 'Failed to load notification channels');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingChannel(null);
    setShowForm(true);
  };

  const handleEdit = (channel: NotificationChannel) => {
    setEditingChannel(channel);
    setShowForm(true);
  };

  const handleDelete = async (channelId: number) => {
     try {
       await api.delete(`/alerts/channels/${channelId}`);
       showSuccess('Notification channel deleted successfully');
       loadChannels();
     } catch (error: any) {
       showError(error.message || 'Failed to delete notification channel');
     }
   };

  const handleToggle = async (channel: NotificationChannel) => {
    try {
      await api.put(`/alerts/channels/${channel.id}`, { enabled: !channel.enabled });
      showSuccess(`Channel ${channel.enabled ? 'disabled' : 'enabled'}`);
      loadChannels();
    } catch (error: any) {
      showError(error.message || 'Failed to toggle channel');
    }
  };

  const handleTest = async (channelId: number) => {
    try {
      setTestingChannelId(channelId);
      const result = await api.post<any>('/alerts/trigger-test', {
        channel_id: channelId,
        site_id: Number(siteId)
      });
      showSuccess(result.message || 'Test alert sent successfully');
      if (result.alert_name) {
        showInfo(`Alert: ${result.alert_name} (${result.severity})`);
      }
    } catch (error: any) {
      showError(error.message || 'Failed to send test alert');
    } finally {
      setTestingChannelId(null);
    }
  };

  const handleFormClose = (shouldReload?: boolean) => {
    setShowForm(false);
    setEditingChannel(null);
    if (shouldReload) {
      loadChannels();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading notification channels...</div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* SMTP not configured banner */}
        {smtpLoaded && smtpConfigured === false && (
          <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">No SMTP configuration</p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                Email notification channels are disabled until an SMTP server is configured in{' '}
                <a href="/admin/settings" className="underline font-medium hover:text-amber-900 dark:hover:text-amber-100">Admin Settings</a>.
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Notification Channels
          </h3>
          {!isViewer() && (
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-sm shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Channel
            </button>
          )}
        </div>

        {/* Channels Grid */}
        {channels.length === 0 ? (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-8 text-center border border-dashed border-gray-300 dark:border-gray-700">
            <Mail className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">No notification channels configured yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {channels.map((channel) => (
              <div
                key={channel.id}
                className={`bg-white dark:bg-gray-800 rounded-xl border p-4 shadow-sm transition-all ${
                  channel.enabled
                    ? 'border-gray-200 dark:border-gray-700'
                    : 'border-gray-100 dark:border-gray-800 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      channel.channel_type === 'email'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                    }`}>
                      {channel.channel_type === 'email' ? <Mail className="w-5 h-5" /> : <Webhook className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white">{channel.name}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">
                        {channel.channel_type}
                      </p>
                    </div>
                  </div>
                  {!isViewer() && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggle(channel)}
                        className={`p-2 rounded-lg transition-colors ${
                          channel.enabled
                            ? 'text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20'
                            : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        title={channel.enabled ? 'Disable' : 'Enable'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleTest(channel.id)}
                        disabled={testingChannelId === channel.id || !channel.enabled}
                        className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors disabled:opacity-50"
                        title="Send Test Notification"
                      >
                        <Zap className={`w-4 h-4 ${testingChannelId === channel.id ? 'animate-pulse' : ''}`} />
                      </button>
                      <button
                        onClick={() => handleEdit(channel)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(channel)}
                        className="button-danger button-sm"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                    {channel.channel_type === 'email'
                      ? channel.email_recipients?.join(', ')
                      : channel.webhook_url}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <NotificationChannelForm
          siteId={siteId}
          channel={editingChannel}
          smtpConfigured={smtpConfigured}
          onClose={handleFormClose}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete notification channel?"
        description={deleteTarget ? `Delete "${deleteTarget.name}".` : undefined}
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          handleDelete(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}
