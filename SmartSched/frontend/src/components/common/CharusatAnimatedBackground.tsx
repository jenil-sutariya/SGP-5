import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  GraduationCap,
  BookOpen,
  Building2,
  Cpu,
  Database,
  Network,
  FlaskConical,
  Code,
  Laptop,
  Sparkles,
  Atom,
  BrainCircuit,
  CalendarDays,
  Clock3,
  Users,
  School,
} from 'lucide-react';

const FLOATING_BADGES = [
  { text: 'CSPIT', x: '8%', y: '15%', delay: 0, duration: 14, rotate: -6 },
  { text: 'DEPSTAR', x: '82%', y: '22%', delay: 2, duration: 16, rotate: 8 },
  { text: 'CHARUSAT', x: '12%', y: '72%', delay: 1, duration: 18, rotate: 5 },
  { text: 'Knowledge is Eternal', x: '75%', y: '78%', delay: 3, duration: 15, rotate: -4 },
  { text: 'Engineering', x: '45%', y: '10%', delay: 4, duration: 20, rotate: -8 },
  { text: 'Innovation', x: '88%', y: '50%', delay: 1.5, duration: 17, rotate: 6 },
  { text: 'Research', x: '5%', y: '45%', delay: 2.5, duration: 19, rotate: 3 },
];

const FLOATING_ICONS = [
  { Icon: GraduationCap, size: 28, x: '18%', y: '28%', delay: 0, duration: 12 },
  { Icon: Cpu, size: 32, x: '70%', y: '15%', delay: 1, duration: 15 },
  { Icon: FlaskConical, size: 30, x: '85%', y: '65%', delay: 2, duration: 14 },
  { Icon: Atom, size: 34, x: '25%', y: '82%', delay: 0.5, duration: 18 },
  { Icon: BrainCircuit, size: 32, x: '60%', y: '85%', delay: 3, duration: 16 },
  { Icon: Code, size: 26, x: '35%', y: '20%', delay: 1.5, duration: 13 },
  { Icon: BookOpen, size: 28, x: '92%', y: '35%', delay: 2.5, duration: 17 },
  { Icon: Building2, size: 30, x: '10%', y: '60%', delay: 4, duration: 19 },
  { Icon: Database, size: 26, x: '48%', y: '75%', delay: 3.5, duration: 15 },
  { Icon: Network, size: 28, x: '78%', y: '42%', delay: 0.8, duration: 14 },
  { Icon: Sparkles, size: 24, x: '52%', y: '30%', delay: 2.2, duration: 11 },
  { Icon: School, size: 30, x: '30%', y: '50%', delay: 1.2, duration: 16 },
  { Icon: CalendarDays, size: 26, x: '65%', y: '55%', delay: 2.8, duration: 13 },
  { Icon: Clock3, size: 24, x: '22%', y: '38%', delay: 4.2, duration: 14 },
  { Icon: Laptop, size: 28, x: '40%', y: '90%', delay: 0.3, duration: 17 },
  { Icon: Users, size: 26, x: '88%', y: '88%', delay: 1.8, duration: 15 },
];

const ORBS = [
  { size: 450, color: 'rgba(11, 61, 145, 0.12)', x: '5%', y: '-10%', delay: 0 },
  { size: 500, color: 'rgba(196, 92, 38, 0.09)', x: '80%', y: '5%', delay: 2 },
  { size: 400, color: 'rgba(56, 189, 248, 0.1)', x: '70%', y: '60%', delay: 1 },
  { size: 380, color: 'rgba(217, 119, 6, 0.08)', x: '15%', y: '65%', delay: 3 },
];

export function CharusatAnimatedBackground() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 40, stiffness: 80 };
  const parallaxX = useSpring(useTransform(mouseX, [-500, 500], [-10, 10]), springConfig);
  const parallaxY = useSpring(useTransform(mouseY, [-500, 500], [-10, 10]), springConfig);

  const rafId = useRef<number | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (rafId.current !== null) return;
      rafId.current = requestAnimationFrame(() => {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        mouseX.set(e.clientX - centerX);
        mouseY.set(e.clientY - centerY);
        rafId.current = null;
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [mouseX, mouseY]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none will-change-transform">
      {/* Background Parallax Layer */}
      <motion.div className="absolute inset-0" style={{ x: parallaxX, y: parallaxY }}>
        {/* Glowing Ambient Gradient Orbs */}
        {ORBS.map((orb, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full blur-3xl will-change-transform"
            style={{
              width: orb.size,
              height: orb.size,
              left: orb.x,
              top: orb.y,
              background: orb.color,
            }}
            animate={{
              scale: [1, 1.08, 1],
              opacity: [0.7, 0.95, 0.7],
            }}
            transition={{
              duration: 10 + i * 2,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: orb.delay,
            }}
          />
        ))}

        {/* Floating CHARUSAT Badges */}
        {FLOATING_BADGES.map((b, i) => (
          <motion.div
            key={i}
            className="absolute hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/20 bg-white/50 dark:bg-slate-900/50 text-xs font-bold tracking-wide text-primary/70 dark:text-cyan-accent/70 shadow-sm will-change-transform"
            style={{ left: b.x, top: b.y }}
            animate={{
              y: [0, -14, 0],
              rotate: [b.rotate, b.rotate + 3, b.rotate],
              opacity: [0.4, 0.7, 0.4],
            }}
            transition={{
              duration: b.duration,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: b.delay,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
            {b.text}
          </motion.div>
        ))}

        {/* Floating Academic Lucide Icons */}
        {FLOATING_ICONS.map(({ Icon, size, x, y, delay, duration }, i) => (
          <motion.div
            key={i}
            className="absolute text-primary/25 dark:text-cyan-accent/20 will-change-transform"
            style={{ left: x, top: y }}
            animate={{
              y: [0, -16, 0],
              x: [0, (i % 2 === 0 ? 8 : -8), 0],
              rotate: [0, (i % 2 === 0 ? 10 : -10), 0],
              opacity: [0.25, 0.5, 0.25],
            }}
            transition={{
              duration,
              repeat: Infinity,
              ease: 'easeInOut',
              delay,
            }}
          >
            <Icon size={size} strokeWidth={1.5} />
          </motion.div>
        ))}

        {/* Delicate Particle Grid Accent */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.03),transparent_70%)]" />
      </motion.div>
    </div>
  );
}
