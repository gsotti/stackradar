import { parseAsUTC } from './dateUtils';
import i18n from '../i18n';

export function formatTimeAgo(date: string | null | undefined): string {
  if (!date) return i18n.t('common:time.never');
  const parsed = parseAsUTC(date);
  if (!parsed) return date;
  const seconds = Math.floor((Date.now() - parsed.getTime()) / 1000);
  if (seconds < 0) return i18n.t('common:time.just_now');
  if (seconds < 60) return i18n.t('common:time.seconds_ago', { n: seconds });
  if (seconds < 3600) return i18n.t('common:time.minutes_ago', { n: Math.floor(seconds / 60) });
  if (seconds < 86400) return i18n.t('common:time.hours_ago', { n: Math.floor(seconds / 3600) });
  return i18n.t('common:time.days_ago', { n: Math.floor(seconds / 86400) });
}
