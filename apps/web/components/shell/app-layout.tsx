'use client';

import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { AppSidebar } from './app-sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [isCollapsed, setIsCollapsed] = React.useState<boolean>(false);
  const [width, setWidth] = React.useState<number>(240);
  const [isResizing, setIsResizing] = React.useState<boolean>(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // Load initial states from localStorage safely on mount
    const savedCollapsed = localStorage.getItem('sidebar_collapsed_state');
    if (savedCollapsed !== null) {
      setIsCollapsed(savedCollapsed === 'true');
    }
    const savedWidth = localStorage.getItem('sidebar_width');
    if (savedWidth !== null) {
      const parsed = parseInt(savedWidth, 10);
      if (!isNaN(parsed) && parsed >= 180 && parsed <= 450) {
        setWidth(parsed);
      }
    }
    setMounted(true);
  }, []);

  const handleCollapseToggle = React.useCallback(() => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed_state', String(next));
      return next;
    });
  }, []);

  if (!mounted) {
    return (
      <div className="bg-background flex h-screen w-screen overflow-hidden">
        <div className="w-60 border-r bg-sidebar" />
        <main className="relative h-full flex-1 overflow-hidden">{children}</main>
      </div>
    );
  }

  return (
    <div className="bg-background flex h-screen w-screen overflow-hidden">
      <AppSidebar
        width={width}
        setWidth={setWidth}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isResizing={isResizing}
        setIsResizing={setIsResizing}
      />
      <main className="relative h-full flex-1 overflow-hidden">
        {/* Reopen Floating Button when sidebar is collapsed */}
        {isCollapsed && (
          <button
            onClick={handleCollapseToggle}
            className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground border-border bg-background/80 fixed top-4 left-4 z-40 flex h-8 w-8 items-center justify-center rounded-lg border shadow-xs backdrop-blur-xs transition-all duration-200 active:scale-95 cursor-pointer"
            title="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        <div className="h-full w-full">{children}</div>
      </main>
    </div>
  );
}
