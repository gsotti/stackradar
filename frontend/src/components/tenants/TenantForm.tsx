import React, { FormEvent, useState } from 'react';
import { Building2 } from 'lucide-react';

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
          {mode === 'create' ? 'Create New Tenant' : 'Edit Tenant'}
        </h2>
      </div>

      <div>
        <label className="text-label mb-2">
          Tenant Name <span className="text-accent-danger">*</span>
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="input-base w-full"
          placeholder="e.g., Acme Corporation"
          required
          maxLength={255}
        />
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          This name appears across dashboards and settings.
        </p>
      </div>

      <div>
        <label className="text-label mb-2">
          Description
        </label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="input-base w-full resize-none"
          placeholder="Brief description of this tenant"
          rows={4}
          maxLength={1000}
        />
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Optional description to help identify this tenant.
        </p>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={submitting}
          className="button-primary flex-1 disabled:opacity-50 justify-center"
        >
          {submitting ? 'Saving...' : submitLabel || (mode === 'create' ? 'Create Tenant' : 'Save Changes')}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="button-secondary flex-1 disabled:opacity-50 justify-center"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
