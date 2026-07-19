import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import { Button, Card, Input, Badge, Skeleton } from '@/components/ui';
import { useAuthStore, type RoleName } from '@/store/authStore';

export type SelectOption = { value: string; label: string; meta?: Record<string, string> };

export type FieldDef = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'select';
  options?: SelectOption[];
  /** When set, only show options whose meta[metaKey] equals form[field] */
  dependsOn?: { field: string; metaKey: string };
};

const ADMIN_EDIT_ROLES: RoleName[] = ['ADMIN', 'INSTITUTE_ADMIN', 'DEPARTMENT_HEAD'];

export function useInstituteScope() {
  const user = useAuthStore((s) => s.user);
  const instituteId = user?.role?.name === 'ADMIN' ? undefined : (user?.instituteId ?? undefined);
  return { user, instituteId };
}

export function buildPayload(form: Record<string, string>, fields: FieldDef[]) {
  const payload: Record<string, unknown> = {};
  for (const f of fields) {
    const val = form[f.key];
    if (val === undefined || val === '') continue;
    payload[f.key] = f.type === 'number' ? Number(val) : val;
  }
  return payload;
}

export function rowToForm(row: Record<string, unknown>, fields: FieldDef[]) {
  const form: Record<string, string> = {};
  for (const f of fields) {
    const v = row[f.key];
    if (v !== undefined && v !== null) form[f.key] = String(v);
  }
  return form;
}

export function FormField({
  field,
  value,
  form,
  onChange,
}: {
  field: FieldDef;
  value: string;
  form: Record<string, string>;
  onChange: (value: string) => void;
}) {
  if (field.type === 'select') {
    const parentValue = field.dependsOn ? (form[field.dependsOn.field] ?? '') : '';
    const visibleOptions = field.dependsOn && parentValue
      ? (field.options ?? []).filter(
          (o) => {
            const metaVal = String(o.meta?.[field.dependsOn!.metaKey] ?? '').trim().toLowerCase();
            const parentValStr = String(parentValue).trim().toLowerCase();
            return metaVal === parentValStr;
          }
        )
      : (field.options ?? []);

    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-10 w-full rounded-xl border border-border bg-white/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-900/50"
      >
        <option value="">{field.label}</option>
        {visibleOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <Input
      type={field.type === 'number' ? 'number' : 'text'}
      placeholder={field.label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function ResourcePage({
  title,
  queryKey,
  listFn,
  columns,
  createFields,
  createFn,
  editFields,
  updateFn,
  removeFn,
  emptyMessage,
  extraQueryKey,
  filters,
}: {
  title: string;
  queryKey: string;
  listFn: (search?: string, page?: number, limit?: number) => Promise<unknown[] | { data: unknown[]; total: number }>;
  columns: { key: string; label: string; render?: (row: Record<string, unknown>) => React.ReactNode }[];
  createFields?: FieldDef[];
  createFn?: (data: Record<string, any>) => Promise<unknown>;
  editFields?: FieldDef[];
  updateFn?: (id: string, data: Record<string, any>) => Promise<unknown>;
  removeFn?: (id: string) => Promise<unknown>;
  emptyMessage?: string;
  extraQueryKey?: unknown[];
  filters?: {
    key: string;
    label: string;
    options: SelectOption[];
    value: string;
    onChange: (val: string) => void;
  }[];
}) {
  const user = useAuthStore((s) => s.user);
  const canEdit =
    !!editFields &&
    !!updateFn &&
    !!user?.role?.name &&
    ADMIN_EDIT_ROLES.includes(user.role.name);

  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  React.useEffect(() => {
    setPage(1);
  }, [search, ...(extraQueryKey ?? [])]);

  const { data: queryData, isLoading, isError, error, refetch } = useQuery({
    queryKey: [queryKey, search, page, limit, ...(extraQueryKey ?? [])],
    queryFn: async () => {
      const res = await listFn(search || undefined, page, limit);
      if (Array.isArray(res)) {
        return { data: res, total: res.length };
      }
      return res;
    },
  });

  const data = queryData?.data ?? [];
  const total = queryData?.total ?? 0;
  const totalPages = Math.ceil(total / limit) || 1;

  const create = useMutation({
    mutationFn: () => createFn!(buildPayload(form, createFields!)),
    onSuccess: () => {
      toast.success('Created');
      setForm({});
      qc.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (e: unknown) =>
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed'),
  });

  const update = useMutation({
    mutationFn: () => updateFn!(editingId!, buildPayload(editForm, editFields!)),
    onSuccess: () => {
      toast.success('Updated');
      setEditingId(null);
      setEditForm({});
      qc.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (e: unknown) =>
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeFn!(id),
    onSuccess: () => {
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (e: unknown) =>
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed'),
  });

  const startEdit = (row: Record<string, unknown>) => {
    setEditingId(String(row.id));
    setEditForm(rowToForm(row, editFields!));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-bold">{title}</h2>
        <p className="text-sm text-muted">Manage {title.toLowerCase()}</p>
      </div>
      <div className="flex gap-2 items-center">
        <Input
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        {filters?.map((f) => (
          <select
            key={f.key}
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            className="flex h-10 w-full max-w-xs rounded-xl border border-border bg-white/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-900/50"
          >
            <option value="">All {f.label}s</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ))}
      </div>
      {createFields && createFn && (
        <Card className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          {createFields.map((f) => (
            <FormField
              key={f.key}
              field={f}
              value={form[f.key] ?? ''}
              form={form}
              onChange={(v) => {
                setForm((s) => {
                  const next = { ...s, [f.key]: v };
                  if (createFields) {
                    for (const cf of createFields) {
                      if (cf.dependsOn?.field === f.key) next[cf.key] = '';
                    }
                  }
                  return next;
                });
              }}
            />
          ))}
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            Add
          </Button>
        </Card>
      )}
      {canEdit && editingId && (
        <Card className="space-y-3 border-primary/30">
          <p className="text-sm font-semibold text-primary">Edit record</p>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
            {editFields!.map((f) => (
              <FormField
                key={f.key}
                field={f}
                value={editForm[f.key] ?? ''}
                form={editForm}
                onChange={(v) => setEditForm((s) => ({ ...s, [f.key]: v }))}
              />
            ))}
            <div className="flex gap-2">
              <Button onClick={() => update.mutate()} disabled={update.isPending}>
                Save
              </Button>
              <Button variant="outline" onClick={cancelEdit}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}
      <Card className="overflow-x-auto p-0">
        {isLoading ? (
          <Skeleton className="m-4 h-40" />
        ) : isError ? (
          <div className="p-6 text-center">
            <p className="text-sm text-danger">
              {(error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                'Failed to load data'}
            </p>
            <Button variant="outline" className="mt-3" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {columns.map((c) => (
                  <th key={c.key} className="p-3 font-semibold">
                    {c.label}
                  </th>
                ))}
                {canEdit && (
                  <th className="p-3 font-semibold">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {(data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (canEdit ? 1 : 0)} className="p-8 text-center text-muted">
                    {emptyMessage ?? 'No records found'}
                  </td>
                </tr>
              ) : (
                (data ?? []).map((row, i) => (
                  <tr key={(row as { id?: string }).id ?? i} className="border-b border-border/50">
                    {columns.map((c) => (
                      <td key={c.key} className="p-3">
                        {c.render
                          ? c.render(row as Record<string, unknown>)
                          : String((row as Record<string, unknown>)[c.key] ?? '—')}
                      </td>
                    ))}
                    {canEdit && (
                      <td className="p-3 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(row as Record<string, unknown>)}
                          disabled={editingId === (row as { id?: string }).id && update.isPending}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        {removeFn && (
                          <Button
                            size="sm"
                           
                            onClick={() => {
                              const id = String((row as { id?: string }).id ?? '');
                              if (!id) return;
                              if (!confirm('Delete this record?')) return;
                              remove.mutate(id);
                            }}
                            disabled={remove.isPending}
                          >
                            Delete
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
        {total > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-3 bg-slate-50/50 dark:bg-slate-900/20 border-t border-border/50 text-sm">
            <div className="text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{((page - 1) * limit) + 1}</span> to{' '}
              <span className="font-semibold text-foreground">{Math.min(page * limit, total)}</span> of{' '}
              <span className="font-semibold text-foreground">{total}</span> results
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = i + 1;
                  if (page > 3 && totalPages > 5) {
                    pageNum = page - 3 + i;
                    if (pageNum + (4 - i) > totalPages) {
                      pageNum = totalPages - 4 + i;
                    }
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="h-8 rounded-lg border border-border bg-white/60 px-2 text-xs outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-900/50"
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
