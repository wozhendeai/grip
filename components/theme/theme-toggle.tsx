'use client';

import { cn } from '@/lib/utils';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

/**
 * ThemeToggle - 3-button toggle for light/dark/system themes
 *
 * Design decision: Using 3 separate icons (like MeritSystems) instead of
 * a dropdown because:
 * - More direct interaction (single click vs click+select)
 * - Visual clarity of current state
 * - Fits well in navbar dropdown layout
 *
 * Icons: Sun (light), Moon (dark), Monitor (system)
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-1">
        <div className="h-8 w-8 rounded-md bg-muted animate-pulse" />
        <div className="h-8 w-8 rounded-md bg-muted animate-pulse" />
        <div className="h-8 w-8 rounded-md bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <ThemeButton
        icon="sun"
        isActive={theme === 'light'}
        onClick={() => setTheme('light')}
        label="Light theme"
      />
      <ThemeButton
        icon="moon"
        isActive={theme === 'dark'}
        onClick={() => setTheme('dark')}
        label="Dark theme"
      />
      <ThemeButton
        icon="system"
        isActive={theme === 'system'}
        onClick={() => setTheme('system')}
        label="System theme"
      />
    </div>
  );
}

interface ThemeButtonProps {
  icon: 'sun' | 'moon' | 'system';
  isActive: boolean;
  onClick: () => void;
  label: string;
}

function ThemeButton({ icon, isActive, onClick, label }: ThemeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
        isActive
          ? 'bg-secondary text-foreground'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
      )}
      aria-label={label}
    >
      {icon === 'sun' && <Sun className="h-4 w-4" />}
      {icon === 'moon' && <Moon className="h-4 w-4" />}
      {icon === 'system' && <Monitor className="h-4 w-4" />}
    </button>
  );
}
