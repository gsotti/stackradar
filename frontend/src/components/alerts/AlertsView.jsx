import { useState } from 'react';
import { Bell, Mail, Clock } from 'lucide-react';
import AlertRuleList from './AlertRuleList';
import NotificationChannelList from './NotificationChannelList';
import AlertHistoryList from './AlertHistoryList';

export default function AlertsView({ siteId }) {
  const [activeSubTab, setActiveSubTab] = useState('rules');

  const tabs = [
    { id: 'rules', label: 'Alert Rules', icon: Bell },
    { id: 'channels', label: 'Notification Channels', icon: Mail },
    { id: 'history', label: 'Alert History', icon: Clock },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors
                  ${
                    activeSubTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div>
        {activeSubTab === 'rules' && <AlertRuleList siteId={siteId} />}
        {activeSubTab === 'channels' && <NotificationChannelList siteId={siteId} />}
        {activeSubTab === 'history' && <AlertHistoryList siteId={siteId} />}
      </div>
    </div>
  );
}
