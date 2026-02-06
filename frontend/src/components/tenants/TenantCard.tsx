import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, Users, Calendar } from 'lucide-react';
import { Tenant } from '../../types';
import { formatInLocalTime } from '../../utils/dateUtils';

interface TenantCardProps {
  tenant: Tenant;
  userCount?: number;
}

export default function TenantCard({ tenant, userCount = 0 }: TenantCardProps) {
  return (
    <Link
      to={`/tenants/${tenant.id}/settings`}
      className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl hover:border-blue-500/50 transition-all duration-300 flex flex-col h-full"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-lg">
          <Building2 className="w-6 h-6 text-white" />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
            {tenant.name}
          </h3>
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2 min-h-[2.5rem] flex-1">
        {tenant.description || 'No description provided.'}
      </p>

      <div className="pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Users className="w-4 h-4" />
          <span>{userCount} {userCount === 1 ? 'user' : 'users'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
          <Calendar className="w-4 h-4" />
          <span>Created {formatInLocalTime(tenant.created_at, 'MMM d, yyyy')}</span>
        </div>
      </div>
    </Link>
  );
}
