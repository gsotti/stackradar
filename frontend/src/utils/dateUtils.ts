import { format } from 'date-fns';

/**
 * Parses a date string and ensures it's treated as UTC if no timezone is present.
 */
export const parseAsUTC = (dateStr: string | null | undefined): Date | null => {
  if (!dateStr) return null;

  // If it's a numeric string (timestamp ms), convert to number
  if (/^\d+$/.test(dateStr)) {
    return new Date(parseInt(dateStr, 10));
  }

  // Ensure the timestamp is treated as UTC if it doesn't have a timezone indicator
  let normalizedDateStr = dateStr;
  if (!dateStr.endsWith('Z') && !dateStr.includes('+')) {
    if (dateStr.includes('T')) {
      normalizedDateStr = `${dateStr}Z`;
    } else if (dateStr.includes(' ')) {
      normalizedDateStr = `${dateStr.replace(' ', 'T')}Z`;
    } else if (dateStr.includes('-') && dateStr.includes(':')) {
      // Handle YYYY-MM-DDHH:mm:ss or similar without space
      normalizedDateStr = `${dateStr}Z`;
    }
  }

  const date = new Date(normalizedDateStr);
  if (isNaN(date.getTime())) {
    const fallbackDate = new Date(dateStr);
    return isNaN(fallbackDate.getTime()) ? null : fallbackDate;
  }
  return date;
};

/**
 * Formats a date string to the local timezone.
 * Ensures that strings without timezone info are treated as UTC.
 */
export const formatInLocalTime = (dateStr: string | null | undefined, formatStr: string) => {
  try {
    const date = parseAsUTC(dateStr);
    if (!date) return dateStr || '-';
    return format(date, formatStr);
  } catch (e) {
    console.error('Error formatting date:', dateStr, e);
    return dateStr || '-';
  }
};
