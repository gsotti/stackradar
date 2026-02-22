/**
 * Parse a value as a positive integer. Returns the number or null if invalid.
 */
export function parsePositiveInt(value: string | number | undefined): number | null {
  if (value === undefined || value === null) return null;
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export interface PasswordValidationResult {
  valid: boolean;
  message: string;
}

export function validatePassword(password: string): PasswordValidationResult {
  if (!password || password.length < 12) {
    return { valid: false, message: 'Password must be at least 12 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character' };
  }
  return { valid: true, message: '' };
}

export function isPrivateUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname;

    // Block private/reserved IP ranges
    const privatePatterns = [
      /^127\./,                          // loopback
      /^10\./,                           // private class A
      /^172\.(1[6-9]|2[0-9]|3[01])\./,  // private class B
      /^192\.168\./,                     // private class C
      /^169\.254\./,                     // link-local / cloud metadata
      /^0\./,                            // current network
      /^::1$/,                           // IPv6 loopback
      /^fc00:/i,                         // IPv6 unique local
      /^fe80:/i,                         // IPv6 link-local
      /^localhost$/i,                    // localhost hostname
    ];

    // Also block common cloud metadata endpoints
    if (hostname === 'metadata.google.internal') return true;

    return privatePatterns.some(p => p.test(hostname));
  } catch {
    return true; // reject unparseable URLs
  }
}
