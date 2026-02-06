import { format } from 'date-fns';

/**
 * Formats a date string to the local timezone.
 * Ensures that strings without timezone info are treated as UTC.
 */
export const formatInLocalTime = (dateStr: string | null | undefined, formatStr: string) => {
  try {
    if (!dateStr) return '-';
    
    // If it's a numeric string (timestamp ms), convert to number
    if (/^\d+$/.test(dateStr)) {
      return format(new Date(parseInt(dateStr, 10)), formatStr);
    }

    // Ensure the timestamp is treated as UTC if it doesn't have a timezone indicator
    // PostgreSQL TIMESTAMP columns usually return strings like "YYYY-MM-DD HH:mm:ss" 
    // or ISO without 'Z'.
    const normalizedDateStr = dateStr.endsWith('Z') || dateStr.includes('+') || dateStr.includes('T') 
      ? (dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : `${dateStr}Z`)
      : `${dateStr.replace(' ', 'T')}Z`;

    const date = new Date(normalizedDateStr);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      // Fallback to original Date constructor if normalization failed
      const fallbackDate = new Date(dateStr);
      if (isNaN(fallbackDate.getTime())) return dateStr;
      return format(fallbackDate, formatStr);
    }

    return format(date, formatStr);
  } catch (e) {
    console.error('Error formatting date:', dateStr, e);
    return dateStr || '-';
  }
};
