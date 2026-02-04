import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Mail, Webhook, Power, Zap } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';
import NotificationChannelForm from './NotificationChannelForm';

export default function NotificationChannelList({ siteId }) {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [testingChannelId, setTestingChannelId] = useState(null);
  const { showError, showSuccess, showInfo } = useNotification();
  const { user } = useAuth();
  const isViewer = user?.is_viewer;

  useEffect(() => {
    loadChannels();
  }, [siteId]);

  const loadChannels = async () => {
    try {
      setLoading(true);
      const data = await api.get(`/alerts/channels?site_id=${siteId}`);
      setChannels(data);
    } catch (error) {
      showError(error.message || 'Failed to load notification channels');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingChannel(null);
    setShowForm(true);
  };

  const handleEdit = (channel) => {
    setEditingChannel(channel);
    setShowForm(true);
  };

  const handleDelete = async (channelId) => {
    if (!confirm('Are you sure you want to delete this notification channel?')) {
      return;
    }

    try {
      await api.delete(`/alerts/channels/${channelId}`);
      showSuccess('Notification channel deleted successfully');
      loadChannels();
    } catch (error) {
      showError(error.message || 'Failed to delete notification channel');
    }
  };

  const handleToggle = async (channel) => {
    try {
      await api.put(`/alerts/channels/${channel.id}`, { enabled: !channel.enabled });
      showSuccess(`Channel ${channel.enabled ? 'disabled' : 'enabled'}`);
      loadChannels();
    } catch (error) {
      showError(error.message || 'Failed to toggle channel');
    }
  };

  const handleTest = async (channelId) => {
    try {
      setTestingChannelId(channelId);
      const result = await api.post('/alerts/trigger-test', {
        channel_id: channelId,
        site_id: siteId
      });
      showSuccess(result.message || 'Test alert sent successfully');
      if (result.alert_name) {
        showInfo(`Alert: ${result.alert_name} (${result.severity})`);
      }
    } catch (error) {
      showError(error.message || 'Failed to send test alert');
    } finally {
      setTestingChannelId(null);
    }
  };

  const handleFormClose = (shouldReload) => {
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
        {/* Header */}
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Notification Channels
          </h3>
          {!isViewer && (
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Create Channel
            </button>
          )}
        </div>

        {/* Channels List */}
        {channels.length === 0 ? (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-12 text-center">
            <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Notification Channels Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {isViewer ? 'No notification channels have been configured for this site.' : 'Create a notification channel to receive alerts via email or webhook'}
            </p>
            {!isViewer && (
              <button
                onClick={handleCreate}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-sm"
              >
                <Plus className="w-4 h-4 inline mr-2" />
                Create Channel
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {channels.map((channel) => (
              <div
                key={channel.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {channel.channel_type === 'email' ? (
                        <Mail className="w-5 h-5 text-blue-500" />
                      ) : (
                        <Webhook className="w-5 h-5 text-purple-500" />
                      )}
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {channel.name}
                      </h4>
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                        {channel.channel_type.toUpperCase()}
                      </span>
                      {!channel.enabled && (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                          DISABLED
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {channel.channel_type === 'email' && channel.email_recipients && (
                        <div>
                          <span className="font-medium">Recipients:</span>{' '}
                          {channel.email_recipients.join(', ')}
                        </div>
                      )}
                      {channel.channel_type === 'webhook' && channel.webhook_url && (
                        <div>
                          <span className="font-medium">URL:</span>{' '}
                          <span className="font-mono text-xs">{channel.webhook_url}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {!isViewer && (
                      <>
                        <button
                          onClick={() => handleTest(channel.id)}
                          disabled={!channel.enabled || testingChannelId === channel.id}
                          className="p-2 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Send Test Alert"
                        >
                          {testingChannelId === channel.id ? (
                            <div className="w-5 h-5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <Zap className="w-5 h-5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleToggle(channel)}
                          className={`p-2 rounded-lg transition-colors ${
                            channel.enabled
                              ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                              : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                          title={channel.enabled ? 'Disable' : 'Enable'}
                        >
                          <Power className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleEdit(channel)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(channel.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <NotificationChannelForm
          siteId={siteId}
          channel={editingChannel}
          onClose={handleFormClose}
        />
      )}
    </>
  );
}
