import { Settings as SettingsIcon, ExternalLink } from 'lucide-react';
import { HolidaySettings } from './HolidaySettings';
import { Card } from '@/components/ui';
import { UNIVERSITY } from '@/constants/university';

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary dark:bg-blue-500/15 dark:text-cyan-accent flex items-center justify-center shrink-0">
            <SettingsIcon size={20} aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Portal Settings
            </h1>
            <p className="text-sm text-muted">
              Configured exclusively for {UNIVERSITY.fullName} ({UNIVERSITY.shortName}).
            </p>
          </div>
        </div>

        <dl className="mt-5 grid sm:grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl border border-border bg-surface-subtle/50 p-3.5">
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted">University</dt>
            <dd className="mt-1 font-semibold text-foreground">{UNIVERSITY.shortName}</dd>
          </div>
          <div className="rounded-xl border border-border bg-surface-subtle/50 p-3.5">
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Campus</dt>
            <dd className="mt-1 font-semibold text-foreground">{UNIVERSITY.campus} — 388421</dd>
          </div>
          <div className="rounded-xl border border-border bg-surface-subtle/50 p-3.5">
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
              Allowed Email Domains
            </dt>
            <dd className="mt-1 font-mono text-xs font-semibold text-foreground">
              @charusat.edu.in, @charusat.ac.in
            </dd>
          </div>
          <div className="rounded-xl border border-border bg-surface-subtle/50 p-3.5">
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted">API Docs</dt>
            <dd className="mt-1">
              <a
                href="http://localhost:5000/api/docs"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-primary dark:text-cyan-accent hover:underline"
              >
                localhost:5000/api/docs <ExternalLink size={13} aria-hidden="true" />
              </a>
            </dd>
          </div>
        </dl>

        <HolidaySettings />
      </Card>
    </div>
  );
}
