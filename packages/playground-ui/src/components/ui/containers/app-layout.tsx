import { cn } from '@/lib/utils';

export function AppLayout({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(`h-screen bg-[#0A0A0A] font-sans grid grid-cols-[auto_1fr] grid-rows-[auto_1fr]`, className)}
      style={{
        ...style,
      }}
    >
      {children}
    </div>
  );
}
