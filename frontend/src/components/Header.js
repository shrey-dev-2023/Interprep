import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Sun, Moon, Flame, LogOut, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';

const themeIcons = { light: Sun, dark: Moon, warm: Flame };
const themeLabels = { light: 'Light', dark: 'Dark', warm: 'Warm' };

export default function Header() {
  const { theme, cycleTheme } = useTheme();
  const { user, logout } = useAuth();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  const ThemeIcon = themeIcons[theme];

  return (
    <header
      data-testid="main-header"
      className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          to="/"
          data-testid="logo-link"
          className="flex items-center gap-2 font-bold tracking-tight text-foreground transition-opacity hover:opacity-80"
          style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
        >
          <span className="text-lg">InterviewPrep</span>
        </Link>

        <div className="flex items-center gap-2">
          <Button
            data-testid="theme-toggle-btn"
            variant="ghost"
            size="sm"
            onClick={cycleTheme}
            className="h-8 gap-1.5 rounded-sm px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ThemeIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{themeLabels[theme]}</span>
          </Button>

          {user && user.role === 'admin' && !isAdmin && (
            <Link to="/admin">
              <Button
                data-testid="admin-dashboard-link"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 rounded-sm px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            </Link>
          )}

          {isAdmin && user && (
            <Button
              data-testid="logout-btn"
              variant="ghost"
              size="sm"
              onClick={logout}
              className="h-8 gap-1.5 rounded-sm px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
