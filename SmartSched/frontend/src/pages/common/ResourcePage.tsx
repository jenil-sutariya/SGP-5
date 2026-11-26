import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Pencil,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Button, Input, Select, Label, Skeleton } from '@/components/ui';
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
  idPrefix = 'field',
}: {
  field: FieldDef;
  value: string;
  form: Record<string, string>;
  onChange: (value: string) => void;
  idPrefix?: string;
}) {
  const inputId = `${idPrefix}-${field.key}`;

  if (field.type === 'select') {
    const parentValue = field.dependsOn ? (form[field.dependsOn.field] ?? '') : '';
    const visibleOptions = field.dependsOn
      ? (field.options ?? []).filter((o) => {
          if (!parentValue) return true;
          if (!o.meta || !o.meta[field.dependsOn!.metaKey]) return true;
          return (
            String(o.meta[field.dependsOn!.metaKey]).trim().toLowerCase() ===
            String(parentValue).trim().toLowerCase()
          );
        })
      : (field.options ?? []);

    return (
      <div className="space-y-1">
        <Label htmlFor={inputId}>{field.label}</Label>
        <Select id={inputId} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select {field.label}</option>
          {visibleOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label htmlFor={inputId}>{field.label}</Label>
      <Input
        id={inputId}
        type={field.type === 'number' ? 'number' : 'text'}
        placeholder={field.label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
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
  listFn: (
    search?: string,
    page?: number,
    limit?: number,
    departmentId?: string
  ) => Promise<unknown[] | { data: unknown[]; total: number }>;
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
        const res = await departmentsApi.list({
          limit: 100,
          ...(instituteId ? { instituteId } : {}),
        });
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
        valA =
          (valA as any).code ||
          (valA as any).name ||
          (valA as any).firstName ||
          JSON.stringify(valA);
      }
      if (valB && typeof valB === 'object') {
        valB =
          (valB as any).code ||
          (valB as any).name ||
          (valB as any).firstName ||
          JSON.stringify(valB);
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
      toast.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Failed to create'
      ),
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
      toast.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Failed to update'
      ),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeFn!(id),
    onSuccess: () => {
      toast.success('Deleted successfully');
      qc.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (e: unknown) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Failed to delete'
      ),
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
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header Bar */}
      <section className="surface-card rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="text-sm text-muted mt-0.5">
            Manage and configure {title.toLowerCase()}.
          </p>
        </div>

        {createFields && createFn && (
          <Button
            variant={showAddForm ? 'outline' : 'default'}
            className="gap-2 shrink-0"
            onClick={() => setShowAddForm((s) => !s)}
          >
            {showAddForm ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            {showAddForm ? 'Close Form' : `Add ${title.slice(0, -1)}`}
          </Button>
        )}
      </section>

      {/* Expandable Creation Form */}
      <AnimatePresence>
        {showAddForm && createFields && createFn && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            <GlassCard
              title={`New ${title.slice(0, -1)}`}
              subtitle="Fill in the details below and save"
              headerIcon={<Plus size={17} aria-hidden="true" />}
            >
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4 items-end">
                {createFields.map((f) => (
                  <FormField
                    key={f.key}
                    field={f}
                    idPrefix="create"
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
                <div className="col-span-full md:col-span-1">
                  <Button
                    onClick={() => create.mutate()}
                    disabled={create.isPending}
                    loading={create.isPending}
                    className="w-full"
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
      <section className="surface-card rounded-2xl p-4 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search
              size={15}
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <Input
              aria-label={`Search ${title.toLowerCase()}`}
              placeholder={`Search ${title.toLowerCase()}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {!hideDepartmentFilter && (
            <Select
              aria-label="Filter by department"
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="w-full sm:w-auto sm:min-w-52 max-w-xs"
            >
              <option value="">All Departments</option>
              {departmentOptions.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          )}

          {filters?.map((f) => (
            <Select
              key={f.key}
              aria-label={`Filter by ${f.label}`}
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              className="w-full sm:w-auto sm:min-w-44 max-w-xs"
            >
              <option value="">All {f.label}s</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          ))}
        </div>
      </section>

      {/* Enterprise Data Table */}
      <section className="surface-card rounded-2xl overflow-hidden">
        {isLoading ? (
          <Skeleton className="m-5 h-48 rounded-xl" />
        ) : isError ? (
          <div className="p-8 text-center">
            <p className="text-sm text-danger font-medium">
              {(error as { response?: { data?: { message?: string } } })?.response?.data
                ?.message ?? 'Failed to load data'}
            </p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>
              Retry Loading
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left bg-surface-subtle select-none">
                  {columns.map((c) => {
                    const isCurrent = (sortField || columns[0]?.key) === c.key;
                    return (
                      <th
                        scope="col"
                        key={c.key}
                        className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => handleSort(c.key)}
                        title={`Sort by ${c.label}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{c.label}</span>
                          {isCurrent ? (
                            sortDir === 'asc' ? (
                              <ChevronUp
                                className="h-4 w-4 text-primary dark:text-cyan-accent"
                                aria-hidden="true"
                              />
                            ) : (
                              <ChevronDown
                                className="h-4 w-4 text-primary dark:text-cyan-accent"
                                aria-hidden="true"
                              />
                            )
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 opacity-35" aria-hidden="true" />
                          )}
                        </div>
                      </th>
                    );
                  })}
                  {canEdit && (
                    <th
                      scope="col"
                      className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted"
                    >
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length + (canEdit ? 1 : 0)}
                      className="p-10 text-center text-muted"
                    >
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
                            'transition-colors hover:bg-surface-subtle/60',
                            isEditingThisRow && 'bg-primary/5 dark:bg-blue-500/10'
                          )}
                        >
                          {columns.map((c) => (
                            <td key={c.key} className="px-4 py-3 text-foreground">
                              {c.render
                                ? c.render(row as Record<string, unknown>)
                                : String((row as Record<string, unknown>)[c.key] ?? '—')}
                            </td>
                          ))}
                          {canEdit && (
                            <td className="px-4 py-3 flex gap-2 items-center">
                              <Button
                                size="sm"
                                variant={isEditingThisRow ? 'default' : 'outline'}
                                onClick={() => {
                                  if (isEditingThisRow) {
                                    cancelEdit();
                                  } else {
                                    startEdit(row as Record<string, unknown>);
                                  }
                                }}
                                disabled={update.isPending}
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                {isEditingThisRow ? 'Cancel' : 'Edit'}
                              </Button>
                              {removeFn && (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  aria-label="Delete record"
                                  onClick={() => {
                                    if (!rowId) return;
                                    if (!confirm('Delete this record?')) return;
                                    remove.mutate(rowId);
                                  }}
                                  disabled={remove.isPending}
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                </Button>
                              )}
                            </td>
                          )}
                        </tr>

                        {/* Inline Card Editor */}
                        {isEditingThisRow && (
                          <tr className="bg-surface-subtle/40">
                            <td colSpan={columns.length + (canEdit ? 1 : 0)} className="p-4">
                              <div className="surface-card rounded-xl p-4 space-y-4 border-primary/30">
                                <div className="flex items-center justify-between border-b border-border pb-2.5">
                                  <p className="text-sm font-bold text-primary dark:text-cyan-accent">
                                    Editing:{' '}
                                    {String((row as any).name || (row as any).code || 'Record')}
                                  </p>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={cancelEdit}
                                    aria-label="Close editor"
                                  >
                                    <X size={14} aria-hidden="true" /> Close
                                  </Button>
                                </div>
                                <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4 items-end">
                                  {editFields!.map((f) => (
                                    <FormField
                                      key={f.key}
                                      field={f}
                                      idPrefix={`edit-${rowId}`}
                                      value={editForm[f.key] ?? ''}
                                      form={editForm}
                                      onChange={(v) => setEditForm((s) => ({ ...s, [f.key]: v }))}
                                    />
                                  ))}
                                  <div className="flex gap-2 items-center col-span-full md:col-span-1">
                                    <Button
                                      onClick={() => update.mutate()}
                                      disabled={update.isPending}
                                      loading={update.isPending}
                                    >
                                      Save Changes
                                    </Button>
                                    <Button variant="outline" onClick={cancelEdit}>
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              </div>
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-5 py-3.5 bg-surface-subtle/60 border-t border-border text-sm">
            <div className="text-muted font-medium text-xs tabular-nums">
              Showing{' '}
              <span className="font-semibold text-foreground">
                {total === 0 ? 0 : (currentPage - 1) * limit + 1}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-foreground">
                {Math.min(currentPage * limit, total)}
              </span>{' '}
              of <span className="font-semibold text-foreground">{total}</span> records
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(1)}
                disabled={currentPage === 1}
              >
                First
              </Button>
              <Button
                variant="outline"
                size="sm"
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
                    className="h-8.5 w-8.5 p-0 tabular-nums"
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                Next
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(totalPages)}
                disabled={currentPage >= totalPages}
              >
                Last
              </Button>

              <Select
                aria-label="Records per page"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="h-8.5 w-auto ml-1 text-xs"
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
