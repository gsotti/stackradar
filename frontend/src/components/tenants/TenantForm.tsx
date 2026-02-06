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
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tenant Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all hover:border-blue-400 dark:hover:border-blue-500 shadow-sm"
          placeholder="e.g., Acme Corporation"
          required
          maxLength={255}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          A unique name for this organization or tenant
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Description
        </label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all hover:border-blue-400 dark:hover:border-blue-500 shadow-sm resize-none"
          placeholder="Brief description of this tenant"
          rows={4}
          maxLength={1000}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Optional description to help identify this tenant
        </p>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Saving...' : submitLabel || (mode === 'create' ? 'Create Tenant' : 'Save Changes')}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold py-2.5 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all border border-gray-200 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
