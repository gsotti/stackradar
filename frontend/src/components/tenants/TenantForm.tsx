import React, { FormEvent, useState } from 'react';
import { Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TenantFormProps {
  initialData?: {
    name: string;
    description: string;
  };
  onSubmit: (data: { name: string; description: string }) => Promise<void>;
  onCancel?: () => void;
  mode: 'create' | 'edit';
  submitLabel?: string;
}

export default function TenantForm({
  initialData = { name: '', description: '' },
  onSubmit,
  onCancel,
  mode,
  submitLabel
}: TenantFormProps) {
  const { t } = useTranslation('tenants');
  const { t: tc } = useTranslation('common');
  const [form, setForm] = useState(initialData);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-primary-500 rounded-xl shadow-lg">
          <Building2 className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-xl font-bold text-primary-600 dark:text-primary-400">
          {mode === 'create' ? t('form.title_create') : t('form.title_edit')}
        </h2>
      </div>

      <div>
        <label className="text-label mb-2">
          {t('form.name_label')}
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="input-base w-full"
          placeholder={t('form.name_placeholder')}
          required
          maxLength={255}
        />
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {t('form.name_help')}
        </p>
      </div>

      <div>
        <label className="text-label mb-2">
          {t('form.description_label')}
        </label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="input-base w-full resize-none"
          placeholder={t('form.description_placeholder')}
          rows={4}
          maxLength={1000}
        />
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {t('form.description_help')}
        </p>
      </div>

      <div className="modal-actions">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="button-secondary button-center disabled:opacity-50"
          >
            {t('form.cancel')}
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className={`button-primary disabled:opacity-50 ${onCancel ? 'button-center' : 'w-full justify-center'}`}
        >
          {submitting 
            ? t('form.submit_saving') 
            : submitLabel || (mode === 'create' ? t('form.submit_create') : t('form.submit_edit'))
          }
        </button>
      </div>
    </form>
  );
}
