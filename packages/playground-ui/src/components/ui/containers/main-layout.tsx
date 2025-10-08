import { cn } from '@/lib/utils';

export function MainLayout({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <main
      className={cn(
        'bg-surface2 rounded-lg border border-border1 overflow-y-auto grid grid-rows-[auto_1fr] mr-[.75rem] mb-[0.75rem]',
        className,
      )}
      style={{
        ...style,
      }}
    >
      {children}
    </main>
  );
}
