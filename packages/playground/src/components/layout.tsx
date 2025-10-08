import React from 'react';

import { AppSidebar } from './ui/app-sidebar';
import { SidebarProvider } from './ui/sidebar';
import { Toaster } from './ui/sonner';
import { ThemeProvider } from './ui/theme-provider';
import { AppLayout, AppHeader, AppHeaderLogo, AppHeaderStars } from '@mastra/playground-ui';
import { MainNav } from './main-nav';
import App from '@/App';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const newUIEnabled = true;

  return newUIEnabled ? (
    <ThemeProvider defaultTheme="dark" attribute="class">
      <AppLayout>
        <AppHeader>
          <AppHeaderLogo variant="playground" /> <AppHeaderStars />
        </AppHeader>
        <MainNav />
        {children}
        <Toaster position="bottom-right" />
      </AppLayout>

      {/* <SidebarProvider>
            <PageLayout>
              <PageHeader>
                <PageHeaderLogo variant="playground" /> <PageHeaderStars />
              </PageHeader>
              <AppSidebar />
              {children}
              <Toaster position="bottom-right" />
            </PageLayout>
          </SidebarProvider> */}
    </ThemeProvider>
  ) : (
    <div className="bg-surface1 font-sans h-screen">
      <ThemeProvider defaultTheme="dark" attribute="class">
        <SidebarProvider>
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] h-full">
            <AppSidebar />
            <div className="bg-surface2 my-3 mr-3 rounded-lg border-sm border-border1 overflow-y-auto">{children}</div>
          </div>
          <Toaster position="bottom-right" />
        </SidebarProvider>
      </ThemeProvider>
    </div>
  );
};
