import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ArrowRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/store/authStore';
import { useFeatureFlagsStore } from '@/store/featureFlagsStore';
import { APP_NAV_ITEMS } from '@/components/layout/AppShell';

export function CommandPaletteModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const flags = useFeatureFlagsStore((s) => s.flags);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const availablePages = useMemo(() => {
    const role = user?.role?.name;
    return APP_NAV_ITEMS.filter((n) => {
      if (n.emails && (!user?.email || !n.emails.includes(user.email.toLowerCase()))) return false;
      if (n.roles && (!role || !n.roles.includes(role))) return false;
      if (n.featureKey && flags[n.featureKey] === false) return false;
      return true;
    });
  }, [user, flags]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availablePages;
    return availablePages.filter(
      (p) =>
        p.label.toLowerCase().includes(q) ||
        p.section.toLowerCase().includes(q) ||
        p.to.toLowerCase().includes(q)
    );
  }, [availablePages, search]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search, isOpen]);

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else window.dispatchEvent(new CustomEvent('open-command-palette'));
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [isOpen, onClose]);

  const handleSelect = (path: string) => {
    navigate(path);
    onClose();
    setSearch('');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-950/55 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick page navigation"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg surface-card rounded-2xl p-3 shadow-2xl overflow-hidden text-foreground"
      >
        <div className="flex items-center gap-2.5 px-3 py-2 border-b border-border">
          <Search size={17} className="text-muted shrink-0" aria-hidden="true" />
          <input
            type="text"
            autoFocus
            aria-label="Search pages"
            placeholder="Jump to timetable, scheduler, rooms, settings…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((prev) => (filtered.length ? (prev + 1) % filtered.length : 0));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((prev) =>
                  filtered.length ? (prev - 1 + filtered.length) % filtered.length : 0
                );
              } else if (e.key === 'Enter' && filtered[selectedIndex]) {
                e.preventDefault();
                handleSelect(filtered[selectedIndex].to);
              }
            }}
            className="w-full bg-transparent text-sm font-medium outline-none text-foreground placeholder:text-muted"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close quick jump"
            className="p-1.5 rounded-lg hover:bg-surface-subtle text-muted hover:text-foreground cursor-pointer"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto p-1.5 space-y-1 mt-1">
          {filtered.length > 0 ? (
            filtered.map((item, index) => {
              const isSelected = index === selectedIndex;
              const Icon = item.icon;
              return (
                <button
                  type="button"
                  key={item.to}
                  onClick={() => handleSelect(item.to)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors text-left',
                    isSelected
                      ? 'bg-primary text-white'
                      : 'hover:bg-surface-subtle text-foreground'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'p-1.5 rounded-lg shrink-0',
                        isSelected ? 'bg-white/20 text-white' : 'bg-surface-subtle text-muted'
                      )}
                    >
                      <Icon size={16} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm leading-tight truncate">{item.label}</p>
                      <p
                        className={cn(
                          'text-xs mt-0.5 capitalize',
                          isSelected ? 'text-white/80' : 'text-muted'
                        )}
                      >
                        {item.section}
                      </p>
                    </div>
                  </div>
                  <ArrowRight
                    size={14}
                    aria-hidden="true"
                    className={cn('shrink-0', isSelected ? 'opacity-100' : 'opacity-40')}
                  />
                </button>
              );
            })
          ) : (
            <div className="p-8 text-center text-muted text-sm">
              No matching pages found.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-3 pt-2 pb-1 border-t border-border text-[11px] text-muted">
          <span>Use ↑↓ arrows and Enter to navigate</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
