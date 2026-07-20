import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Pencil, ArrowUpDown, ChevronUp, ChevronDown, Plus, Search, Filter, Trash2, X } from 'lucide-react';
import { Button, Input, Badge, Skeleton } from '@/components/ui';
import { GlassCard } from '@/components/common/GlassCard';
import { useAuthStore, type RoleName } from '@/store/authStore';
import { departmentsApi } from '@/api';
import { cn } from '@/utils/cn';

export type SelectOption = { value: string; label: string; meta?: Record<string, string> };

export type FieldDef = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'select';
  options?: SelectOption[];
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
    if (v !== undefined && v !== null) {
      if (typeof v === 'object' && v !== null) {
        form[f.key] = String((v as any).id ?? (v as any).code ?? (v as any).name ?? '');
      } else {
        form[f.key] = String(v);
      }
    }
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
        className="flex h-10 w-full rounded-xl border border-border bg-white/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-900/60 font-medium"
      >
        <option value="">Select {field.label}</option>
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
      className="rounded-xl"
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
  hideDepartmentFilter = false,
}: {
  title: string;
  queryKey: string;
  listFn: (search?: string, page?: number, limit?: number, departmentId?: string) => Promise<unknown[] | { data: unknown[]; total: number }>;
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
  hideDepartmentFilter?: boolean;
}) {
  const user = useAuthStore((s) => s.user);
  const { instituteId } = useInstituteScope();
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
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);

  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const { data: deptList } = useQuery({
    queryKey: ['departments', 'filter-options', instituteId ?? 'all'],
    enabled: !hideDepartmentFilter,
    queryFn: async () => {
      try {
        const res = await departmentsApi.list({ limit: 100, ...(instituteId ? { instituteId } : {}) });
        const raw = (res as any)?.data?.data ?? (res as any)?.data ?? [];
        return raw as { id: string; code: string; name: string }[];
      } catch {
        return [];
      }
    },
  });

  const departmentOptions = useMemo(() => {
    return (deptList ?? []).map((d) => ({
      value: d.id,
      label: d.code ? `${d.code} — ${d.name}` : d.name,
    }));
  }, [deptList]);

  React.useEffect(() => {
    setPage(1);
  }, [search, selectedDeptId, ...(extraQueryKey ?? [])]);

  const { data: queryData, isLoading, isError, error, refetch } = useQuery({
    queryKey: [queryKey, search, page, limit, selectedDeptId, ...(extraQueryKey ?? [])],
    queryFn: async () => {
      const res = await listFn(search || undefined, page, limit, selectedDeptId || undefined);
      if (Array.isArray(res)) {
        return { data: res, total: res.length, isArray: true };
      }
      if (res && typeof res === 'object') {
        const rawData = Array.isArray((res as any).data)
          ? (res as any).data
          : Array.isArray((res as any).items)
          ? (res as any).items
          : Array.isArray(res)
          ? res
          : [];

        const total =
          (res as any).meta?.pagination?.total ??
          (res as any).total ??
          (res as any).count ??
          (res as any).totalCount ??
          rawData.length;

        return { data: rawData, total, isArray: false };
      }
      return { data: [], total: 0, isArray: false };
    },
  });

  const rawData = (queryData?.data ?? []) as Record<string, unknown>[];
  const isArrayResponse = queryData?.isArray ?? false;
  const total = queryData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(page, totalPages);

  const sortedData = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];
    const items = [...rawData];

    const key =
      sortField ||
      columns.find((c) => ['code', 'name', 'employeeId', 'enrollmentNo'].includes(c.key))?.key ||
      columns[0]?.key ||
      'name';

    return items.sort((a, b) => {
      let valA = a[key];
      let valB = b[key];

      if (valA && typeof valA === 'object') {
        valA = (valA as any).code || (valA as any).name || (valA as any).firstName || JSON.stringify(valA);
      }
      if (valB && typeof valB === 'object') {
        valB = (valB as any).code || (valB as any).name || (valB as any).firstName || JSON.stringify(valB);
      }

      const strA = String(valA ?? '').toLowerCase();
      const strB = String(valB ?? '').toLowerCase();

      const cmp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rawData, sortField, sortDir, columns]);

  const displayData = useMemo(() => {
    if (!isArrayResponse && rawData.length <= limit) {
      return sortedData;
    }
    const start = (currentPage - 1) * limit;
    return sortedData.slice(start, start + limit);
  }, [sortedData, isArrayResponse, rawData.length, limit, currentPage]);

  const handleSort = (key: string) => {
    if (sortField === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(key);
      setSortDir('asc');
    }
  };

  const create = useMutation({
    mutationFn: () => createFn!(buildPayload(form, createFields!)),
    onSuccess: () => {
      toast.success('Created successfully');
      setForm({});
      setShowAddForm(false);
      qc.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (e: unknown) =>
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create'),
  });

  const update = useMutation({
    mutationFn: () => updateFn!(editingId!, buildPayload(editForm, editFields!)),
    onSuccess: () => {
      toast.success('Updated successfully');
      setEditingId(null);
      setEditForm({});
      qc.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (e: unknown) =>
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to update'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeFn!(id),
    onSuccess: () => {
      toast.success('Deleted successfully');
      qc.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (e: unknown) =>
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to delete'),
  });

  const startEdit = (row: Record<string, unknown>) => {
    setEditingId(String(row.id));
    setEditForm(rowToForm(row, editFields!));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxButtons = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxButtons - 1);
    if (end - start + 1 < maxButtons) {
      start = Math.max(1, end - maxButtons + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <GlassCard className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-foreground">{title}</h2>
          <p className="text-sm text-muted font-medium">Manage and configure {title.toLowerCase()}</p>
        </div>

        {createFields && createFn && (
          <Button
            variant="default"
            className="rounded-xl gap-2 font-bold shadow-md shadow-primary/20 bg-gradient-to-r from-primary to-primary-light"
            onClick={() => setShowAddForm((s) => !s)}
          >
            {showAddForm ? <X size={16} /> : <Plus size={16} />}
            {showAddForm ? 'Close Form' : `Add ${title.slice(0, -1)}`}
          </Button>
        )}
      </GlassCard>

      {/* Expandable Creation Form */}
      <AnimatePresence>
        {showAddForm && createFields && createFn && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <GlassCard title={`New ${title.slice(0, -1)}`} subtitle="Enter details below" headerIcon={<Plus size={18} />}>
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4 pt-2">
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
                <div className="col-span-full md:col-span-1 flex gap-2 items-center mt-1">
                  <Button
                    onClick={() => create.mutate()}
                    disabled={create.isPending}
                    loading={create.isPending}
                    className="w-full rounded-xl font-bold"
                  >
                    Save Record
                  </Button>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter & Search Toolbar */}
      <GlassCard className="p-4 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center flex-1 max-w-3xl">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              placeholder={`Search ${title.toLowerCase()}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>

          {!hideDepartmentFilter && (
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="flex h-10 w-full max-w-xs rounded-xl border border-border bg-white/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-900/60 font-medium"
            >
              <option value="">All Departments</option>
              {departmentOptions.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          )}

          {filters?.map((f) => (
            <select
              key={f.key}
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              className="flex h-10 w-full max-w-xs rounded-xl border border-border bg-white/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-900/60 font-medium"
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
      </GlassCard>

      {/* Enterprise Data Table Glass Container */}
      <GlassCard className="p-0 overflow-hidden border border-white/20 dark:border-white/10 shadow-xl">
        {isLoading ? (
          <Skeleton className="m-4 h-48 rounded-xl" />
        ) : isError ? (
          <div className="p-8 text-center">
            <p className="text-sm text-danger font-medium">
              {(error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                'Failed to load data'}
            </p>
            <Button variant="outline" className="mt-4 rounded-xl" onClick={() => refetch()}>
              Retry Loading
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left bg-slate-100/60 dark:bg-slate-900/60 select-none">
                  {columns.map((c) => {
                    const isCurrent = (sortField || columns[0]?.key) === c.key;
                    return (
                      <th
                        key={c.key}
                        className="p-3.5 font-bold text-xs uppercase tracking-wider text-muted cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
                        onClick={() => handleSort(c.key)}
                        title={`Sort by ${c.label}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{c.label}</span>
                          {isCurrent ? (
                            sortDir === 'asc' ? (
                              <ChevronUp className="h-4 w-4 text-primary dark:text-cyan-accent" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-primary dark:text-cyan-accent" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 opacity-30 hover:opacity-70" />
                          )}
                        </div>
                      </th>
                    );
                  })}
                  {canEdit && <th className="p-3.5 font-bold text-xs uppercase tracking-wider text-muted">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {displayData.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + (canEdit ? 1 : 0)} className="p-10 text-center text-muted">
                      {emptyMessage ?? 'No records found matching criteria'}
                    </td>
                  </tr>
                ) : (
                  displayData.map((row, i) => {
                    const rowId = String((row as { id?: string }).id ?? i);
                    const isEditingThisRow = editingId === rowId;
                    return (
                      <React.Fragment key={rowId}>
                        <tr
                          className={cn(
                            'border-b border-border/40 transition-colors hover:bg-primary/5 dark:hover:bg-cyan-accent/5 font-medium',
                            isEditingThisRow && 'bg-primary/10 dark:bg-cyan-accent/10'
                          )}
                        >
                          {columns.map((c) => (
                            <td key={c.key} className="p-3.5 text-foreground">
                              {c.render
                                ? c.render(row as Record<string, unknown>)
                                : String((row as Record<string, unknown>)[c.key] ?? '—')}
                            </td>
                          ))}
                          {canEdit && (
                            <td className="p-3.5 flex gap-2 items-center">
                              <Button
                                size="sm"
                                variant={isEditingThisRow ? 'default' : 'outline'}
                                className="rounded-lg h-8 px-2.5 text-xs font-semibold"
                                onClick={() => {
                                  if (isEditingThisRow) {
                                    cancelEdit();
                                  } else {
                                    startEdit(row as Record<string, unknown>);
                                  }
                                }}
                                disabled={update.isPending}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                {isEditingThisRow ? 'Cancel' : 'Edit'}
                              </Button>
                              {removeFn && (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  className="rounded-lg h-8 px-2.5 text-xs font-semibold"
                                  onClick={() => {
                                    if (!rowId) return;
                                    if (!confirm('Delete this record?')) return;
                                    remove.mutate(rowId);
                                  }}
                                  disabled={remove.isPending}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </td>
                          )}
                        </tr>

                        {/* Inline Card Editor */}
                        {isEditingThisRow && (
                          <tr className="bg-primary/5 dark:bg-slate-900/80 border-b border-primary/30">
                            <td colSpan={columns.length + (canEdit ? 1 : 0)} className="p-4">
                              <GlassCard className="space-y-4 border-primary/40 shadow-xl bg-white/90 dark:bg-slate-900/90">
                                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                                  <p className="text-sm font-bold text-primary dark:text-cyan-accent">
                                    Editing record: {String((row as any).name || (row as any).code || 'Item')}
                                  </p>
                                  <Button variant="ghost" size="sm" onClick={cancelEdit}>
                                    ✕ Close
                                  </Button>
                                </div>
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
                                  <div className="flex gap-2 items-center col-span-full md:col-span-1 pt-1">
                                    <Button onClick={() => update.mutate()} disabled={update.isPending} loading={update.isPending} className="rounded-xl font-bold">
                                      Save Changes
                                    </Button>
                                    <Button variant="outline" onClick={cancelEdit} className="rounded-xl">
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              </GlassCard>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 py-4 bg-slate-100/50 dark:bg-slate-900/40 border-t border-border/40 text-sm">
            <div className="text-muted font-medium text-xs">
              Showing <span className="font-bold text-foreground">{total === 0 ? 0 : (currentPage - 1) * limit + 1}</span> to{' '}
              <span className="font-bold text-foreground">{Math.min(currentPage * limit, total)}</span> of{' '}
              <span className="font-bold text-foreground">{total}</span> records
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg h-8 text-xs font-semibold"
                onClick={() => setPage(1)}
                disabled={currentPage === 1}
              >
                « First
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg h-8 text-xs font-semibold"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>

              <div className="flex items-center gap-1">
                {pageNumbers.map((pageNum) => (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 w-8 p-0 rounded-lg text-xs font-bold"
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="rounded-lg h-8 text-xs font-semibold"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                Next
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg h-8 text-xs font-semibold"
                onClick={() => setPage(totalPages)}
                disabled={currentPage >= totalPages}
              >
                Last »
              </Button>

              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="h-8 rounded-lg border border-border bg-white/60 px-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/40 dark:bg-slate-900/60 ml-2"
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
      </GlassCard>
    </div>
  );
}
