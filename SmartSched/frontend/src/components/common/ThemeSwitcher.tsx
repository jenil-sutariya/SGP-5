import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '@/store/authStore';

export function ThemeSwitcher() {
  const { theme, setTheme } = useThemeStore();
  const prefersDark =
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="h-9 w-9 rounded-xl border border-border bg-card text-foreground hover:bg-surface-subtle transition-colors duration-150 flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      {isDark ? (
        <Sun size={17} className="text-amber-400" aria-hidden="true" />
      ) : (
        <Moon size={17} className="text-primary" aria-hidden="true" />
      )}
    </button>
  );
}
