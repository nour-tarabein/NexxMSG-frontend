import React from 'react';
import { motion } from 'framer-motion';
import { Home, Bell, Settings, User, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';

const menuItems = [
  { icon: <Home className="h-5 w-5" />, label: "Home", href: "/", gradient: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(37,99,235,0.06) 50%, rgba(29,78,216,0) 100%)", iconColor: "text-blue-500" },
  { icon: <Bell className="h-5 w-5" />, label: "Notifications", href: "/notifications", gradient: "radial-gradient(circle, rgba(249,115,22,0.15) 0%, rgba(234,88,12,0.06) 50%, rgba(194,65,12,0) 100%)", iconColor: "text-orange-500" },
  { icon: <Settings className="h-5 w-5" />, label: "Settings", href: "/settings", gradient: "radial-gradient(circle, rgba(34,197,94,0.15) 0%, rgba(22,163,74,0.06) 50%, rgba(21,128,61,0) 100%)", iconColor: "text-green-500" },
  { icon: <User className="h-5 w-5" />, label: "Profile", href: "/profile", gradient: "radial-gradient(circle, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.06) 50%, rgba(185,28,28,0) 100%)", iconColor: "text-red-500" },
];

const itemVariants = { initial: { rotateX: 0, opacity: 1 }, hover: { rotateX: -90, opacity: 0 } };
const backVariants = { initial: { rotateX: 90, opacity: 0 }, hover: { rotateX: 0, opacity: 1 } };
const glowVariants = { initial: { opacity: 0, scale: 0.8 }, hover: { opacity: 1, scale: 1.5, transition: { opacity: { duration: 0.5 }, scale: { type: 'spring', stiffness: 300, damping: 25 } } } };
const navGlowVariants = { initial: { opacity: 0 }, hover: { opacity: 1, transition: { duration: 0.5 } } };
const sharedTransition = { type: 'spring', stiffness: 100, damping: 20, duration: 0.5 };

export default function MenuBar() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <motion.nav
      className="relative overflow-hidden p-2 rounded-2xl bg-gradient-to-b from-background/80 to-background/40 backdrop-blur-lg border border-border/40 shadow-lg flex justify-center"
      initial="initial"
      whileHover="hover"
    >
      <motion.div
        className={
          `absolute -inset-2 rounded-3xl pointer-events-none ` +
          (isDark
            ? 'bg-gradient-radial from-transparent via-blue-400/30 via-purple-400/30 via-red-400/30 to-transparent'
            : 'bg-gradient-radial from-transparent via-blue-400/20 via-purple-400/20 via-red-400/20 to-transparent')
        }
        variants={navGlowVariants}
      />

      <ul className="flex items-center gap-2 relative z-10">
        {menuItems.map(item => (
          <motion.li key={item.label} className="relative">
            <motion.div
              className="group relative rounded-full overflow-hidden flex items-center"
              style={{ perspective: '600px' }}
              initial="initial"
              whileHover="hover"
            >
              <motion.div
                className="absolute inset-0 pointer-events-none"
                variants={glowVariants}
                style={{ background: item.gradient }}
              />

              <motion.a
                href={item.href}
                className="flex items-center gap-2 px-4 py-2 text-muted-foreground group-hover:text-foreground transition-colors rounded-full border border-border hover:border-coral"
                variants={itemVariants}
                transition={sharedTransition}
                style={{ transformStyle: 'preserve-3d', transformOrigin: 'center bottom' }}
              >
                <span className={`transition-colors duration-300 group-hover:${item.iconColor}`}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </motion.a>

              {/* Back face */}
              <motion.a
                href={item.href}
                className="flex items-center gap-2 px-4 py-2 absolute inset-0 text-muted-foreground group-hover:text-foreground transition-colors rounded-full border border-border hover:border-coral"
                variants={backVariants}
                transition={sharedTransition}
                style={{ transformStyle: 'preserve-3d', transformOrigin: 'center top', rotateX: 90 }}
              >
                <span className={`transition-colors duration-300 group-hover:${item.iconColor}`}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </motion.a>
            </motion.div>
          </motion.li>
        ))}

        <li>
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="flex items-center justify-center w-10 h-10 rounded-full border border-border transition-colors hover:border-coral"
          >
            {isDark ? <Sun className="h-5 w-5 text-foreground" /> : <Moon className="h-5 w-5 text-foreground" />}
          </button>
        </li>
      </ul>
    </motion.nav>
  );
}
