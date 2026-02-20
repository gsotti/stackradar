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
        <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
          <Building2 className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          {mode === 'create' ? 'Create New Tenant' : 'Edit Tenant'}
        </h2>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
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
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
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
          className="button-primary flex-1 disabled:opacity-50"
        >
          {submitting ? 'Saving...' : submitLabel || (mode === 'create' ? 'Create Tenant' : 'Save Changes')}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="button-secondary flex-1 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
