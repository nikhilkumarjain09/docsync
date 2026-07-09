'use client';

import * as React from 'react';
import { AppSidebar } from './app-sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="bg-background flex h-screen w-screen overflow-hidden">
      <AppSidebar />
      <main className="relative h-full flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
