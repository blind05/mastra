import { cn } from '@/lib/utils';

export function AppHeader({
  children,
  className,
  style,
}: {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <header
      className={cn(`px-[1rem] py-[0.5rem] col-span-2 min-h-[3.375rem] flex justify-between items-center`, className)}
      style={style}
    >
      {children}
    </header>
  );
}
