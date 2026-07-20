import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  LayoutDashboard,
  CalendarDays,
  Cpu,
  Users,
  GraduationCap,
  Building2,
  BookOpen,
  DoorOpen,
  FlaskConical,
  Settings,
  X,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/utils/cn';

const PAGES = [
  { path: '/dashboard', title: 'Dashboard', category: 'Overview', icon: LayoutDashboard },
  { path: '/timetable', title: 'My Timetable', category: 'Schedule', icon: CalendarDays },
  { path: '/scheduler', title: 'AI Timetable Generator', category: 'Engine', icon: Cpu },
  { path: '/faculty', title: 'Professors & Faculty', category: 'Academic Resources', icon: Users },
  { path: '/students', title: 'Students Directory', category: 'Academic Resources', icon: GraduationCap },
  { path: '/departments', title: 'Departments', category: 'Academic Resources', icon: Building2 },
  { path: '/sections', title: 'Sections & Batches', category: 'Academic Resources', icon: Users },
  { path: '/courses', title: 'Courses', category: 'Academic Resources', icon: BookOpen },
  { path: '/subjects', title: 'Subjects', category: 'Academic Resources', icon: BookOpen },
  { path: '/rooms', title: 'Classrooms', category: 'Facilities', icon: DoorOpen },
  { path: '/labs', title: 'Laboratories', category: 'Facilities', icon: FlaskConical },
  { path: '/settings', title: 'Settings & Preferences', category: 'Account', icon: Settings },
];

export function CommandPaletteModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = PAGES.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else window.dispatchEvent(new CustomEvent('open-command-palette'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSelect = (path: string) => {
    navigate(path);
    onClose();
    setSearch('');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-xl glass rounded-3xl p-4 border border-white/20 dark:border-white/10 shadow-2xl overflow-hidden relative text-foreground"
        >
          {/* Search Input Bar */}
          <div className="flex items-center gap-3 px-3 py-2 border-b border-border/40">
            <Search size={18} className="text-primary dark:text-cyan-accent" />
            <input
              type="text"
              autoFocus
              placeholder="Type a command or page to search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm font-semibold outline-none text-foreground placeholder:text-muted"
            />
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-muted"
            >
              <X size={16} />
            </button>
          </div>

          {/* Filtered Pages List */}
          <div className="max-h-80 overflow-y-auto p-2 space-y-1 mt-2">
            {filtered.length > 0 ? (
              filtered.map((item, index) => {
                const isSelected = index === selectedIndex;
                const Icon = item.icon;
                return (
                  <div
                    key={item.path}
                    onClick={() => handleSelect(item.path)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all',
                      isSelected
                        ? 'bg-primary text-white shadow-md shadow-primary/30'
                        : 'hover:bg-primary/10 hover:text-primary dark:hover:text-cyan-accent text-foreground/80'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn('p-2 rounded-xl', isSelected ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary dark:text-cyan-accent')}>
                        <Icon size={16} />
                      </div>
                      <div>
                        <p className="font-bold text-sm leading-tight">{item.title}</p>
                        <p className={cn('text-xs mt-0.5', isSelected ? 'text-white/80' : 'text-muted')}>
                          {item.category}
                        </p>
                      </div>
                    </div>
                    <ArrowRight size={14} className={cn('opacity-60', isSelected && 'opacity-100')} />
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-muted text-xs">
                No matching commands or pages found.
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
