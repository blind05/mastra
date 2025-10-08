'use client';

import { cn } from '@/lib/utils';
import { PanelRightIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

export type AppSidebarItem = {
  label: string;
  to?: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  variant?: 'featured' | 'default';
};

export type AppSidebarSection = {
  title?: string;
  items: AppSidebarItem[];
};

export function AppSidebar({
  items,
  className,
  style,
  linkComponent,
  currentPath,
}: {
  items: AppSidebarSection[];
  className?: string;
  style?: React.CSSProperties;
  linkComponent?: React.ElementType;
  currentPath?: string;
}) {
  const LinkComponent = linkComponent || null;
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsCollapsed(window.innerWidth < 1024);
    };

    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div
      className={cn(
        'h-full grid grid-rows-[1fr_auto] relative overflow-y-auto pl-[1rem] pr-[0.75rem]',

        className,
      )}
      style={{
        ...style,
      }}
    >
      <nav className="flex flex-col content-start h-full overflow-y-auto ">
        {items.map((section, idx) => (
          <div
            className={cn('relative grid', {
              'before:content-[""] before:absolute before:top-[1rem] before:left-[0.75rem] before:right-[0.75rem] before:h-[0px] before:border-b before:border-border1':
                idx > 0,
              'mt-auto': idx === items.length - 1,
              'pt-[2rem]': idx > 0,
            })}
          >
            {section.title && (
              <h3 className="text-[0.6875rem] uppercase text-icon3/60 pr-[.75rem] absolute top-[.5rem] left-[.75rem] tracking-[0.25em] bg-black">
                {section.title}
              </h3>
            )}
            <ul key={idx} className={cn('grid gap-[0.25rem] items-start content-center relative', {})}>
              {section.items.map((item, itemIdx) => {
                const isActive = item.to ? currentPath?.startsWith(item.to) : false;
                const isFeatured = item.variant === 'featured';

                return (
                  <li
                    key={itemIdx}
                    className={cn(
                      '[&>a]:flex [&>a]:items-center [&>a]:min-h-[2rem] [&>a]:gap-[10px] [&>a]:text-[13px] [&>a]:text-icon3 [&>a]:py-[6px] [&>a]:px-[0.75rem]',
                      '[&>a:hover]:bg-surface4 [&>a:hover]:text-icon5',
                      '[&_svg]:w-[16px] [&_svg]:h-[16px] [&_svg]:text-icon3',
                      {
                        '[&>a]:text-icon5 [&>a]:bg-surface3': isActive,
                        '[&_svg]:text-icon5': isActive,
                        '[&>a]:rounded-md [&>a]:bg-accent1/75 [&>a:hover]:bg-accent1/85 [&>a]:mx-[8px] [&>a]:my-[0rem] [&>a]:text-black [&>a:hover]:text-black':
                          isFeatured,
                        '[&_svg]:text-black/75': isFeatured,
                      },
                    )}
                  >
                    {LinkComponent && (item.to || !item.href?.startsWith('http')) && (
                      <LinkComponent to={item.to || undefined} href={item.href || undefined}>
                        {item.icon}
                        {!isCollapsed && (
                          <div className="min-w-[8rem] flex justify-between items-center">
                            {item.label}
                            {item.badge}
                          </div>
                        )}
                      </LinkComponent>
                    )}
                    {item.href && item.href?.startsWith('http') && (
                      <a href={item.href} target="_blank" rel="noopener noreferrer">
                        {item.icon}
                        {!isCollapsed && (
                          <div className="min-w-[8rem] flex justify-between items-center">
                            {item.label}
                            {item.badge}
                          </div>
                        )}
                      </a>
                    )}
                    {(!item.href && !item.to) ||
                      (item.href && item.to && (
                        <>{console.log("'to' or 'href' property is required (AppSidebar item)")}</>
                      ))}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div
        className={cn(
          'relative grid pt-[2rem] pb-[1rem] justify-end',
          'before:content-[""] before:absolute before:top-[1rem] before:left-[0.75rem] before:right-[0.75rem] before:h-[0px] before:border-b before:border-border1',
        )}
      >
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            'flex w-auto items-center text-icon3 h-[2rem] hover:bg-surface4 px-[0.75rem] rounded-md',
            '[&_svg]:w-[1rem] [&_svg]:h-[1rem] [&_svg]:text-icon3',
          )}
          aria-label="Toggle sidebar"
        >
          <PanelRightIcon
            className={cn({
              'rotate-180': isCollapsed,
            })}
          />
        </button>
      </div>

      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn('w-[1rem] h-full right-0 top-0 absolute opacity-10', {
          'cursor-w-resize': !isCollapsed,
          'cursor-e-resize': isCollapsed,
        })}
        aria-label="Toggle sidebar"
      ></button>
    </div>
  );
}
