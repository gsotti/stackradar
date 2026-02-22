import React, { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';

export default function LoginPage() {
  const { t } = useTranslation('auth');
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await login(email, password);
      
      const isSuperadmin = response.user?.global_role === 'superadmin' || 
                          (response as any).global_role === 'superadmin';

      // Small delay to ensure state is updated before navigation
      setTimeout(() => {
        if (isSuperadmin) {
          navigate('/superadmin');
        } else {
          navigate('/');
        }
      }, 100);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-400/20 dark:bg-purple-600/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>

      <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-2xl p-8 w-full max-w-md border border-gray-200/50 dark:border-gray-700/50 hover:shadow-3xl transition-all duration-300">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4 hover:scale-110 transition-transform duration-300">
            <Logo size={80} />
          </div>
          <h1 className="text-3xl font-bold text-primary-600 dark:text-primary-400">{t('page.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{t('page.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('form.email_label')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white placeholder-gray-400 transition-all duration-300 hover:border-blue-400 dark:hover:border-blue-500 focus:shadow-lg focus:shadow-blue-500/20"
              placeholder={t('form.email_placeholder')}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('form.password_label')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white placeholder-gray-400 transition-all duration-300 hover:border-blue-400 dark:hover:border-blue-500 focus:shadow-lg focus:shadow-blue-500/20"
              placeholder={t('form.password_placeholder')}
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm border border-red-200 dark:border-red-800 animate-shake">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="button-primary w-full justify-center"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                {t('actions.signing_in')}
              </span>
            ) : (
              t('actions.sign_in')
            )}
          </button>
        </form>
      </div>

      {/* Version footer */}
      <div className="absolute bottom-4 left-0 right-0 text-center text-xs text-gray-400 dark:text-gray-500">
        <span>v{__BUILD_VERSION__}</span>
        {__BUILD_COMMIT__ !== 'local' && (
          <span className="ml-2">({__BUILD_COMMIT__.substring(0, 7)})</span>
        )}
      </div>
    </div>
  );
}
