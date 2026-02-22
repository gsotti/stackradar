import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, Users, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tenant } from '../../types';
import { formatInLocalTime } from '../../utils/dateUtils';

interface TenantCardProps {
  tenant: Tenant;
  userCount?: number;
}

export default function TenantCard({ tenant, userCount = 0 }: TenantCardProps) {
  const { t } = useTranslation('tenants');
  const { t: tc } = useTranslation('common');
  
  return (
    <Link to={`/tenants/${tenant.id}/settings`} className="block">
      <div className="card-hover">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-lg">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white truncate">
              {tenant.name}
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2">
              {tenant.description || t('card.no_description')}
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-neutral-100 dark:border-neutral-700 space-y-2">
          <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <Users className="w-4 h-4" />
            <span>{t('card.user_count', { count: Number(userCount) || 0 })}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <Calendar className="w-4 h-4" />
            <span>{t('card.created', { date: formatInLocalTime(tenant.created_at, 'MMM d, yyyy') })}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
