import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '@/store/authStore';

export function ThemeSwitcher() {
  const { theme, setTheme } = useThemeStore();
  const isDark = theme === 'dark';

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <motion.button
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className="p-2.5 rounded-xl glass text-foreground hover:text-primary dark:hover:text-cyan-accent transition-colors relative flex items-center justify-center border border-border/60 shadow-sm"
    >
      <motion.div
        key={theme}
        initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-primary" />}
      </motion.div>
    </motion.button>
  );
}
