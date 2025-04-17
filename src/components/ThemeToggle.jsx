import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import '../main.css'; // ensure Tailwind and custom vars are loaded

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <div className="flex items-center space-x-2 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
      <Sun
        className={`h-5 w-5 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          isDark ? 'text-muted-foreground scale-75 rotate-12' : 'text-primary-foreground scale-100 rotate-0'
        }`}
      />

      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={isDark}
          onChange={toggleTheme}
        />
        <div className="w-12 h-6 bg-muted peer-focus:ring-4 peer-focus:ring-primary/50 rounded-full peer peer-checked:bg-primary transition-colors duration-300 ease-in-out" />
        <div className="absolute left-1 top-1 bg-card w-4 h-4 rounded-full transition-transform duration-300 ease-in-out peer-checked:translate-x-6" />
      </label>

      <Moon
        className={`h-5 w-5 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          !isDark ? 'text-muted-foreground scale-75 rotate-12' : 'text-primary-foreground scale-100 rotate-0'
        }`}
      />
    </div>
  );
}
