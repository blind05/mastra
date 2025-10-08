import { cn } from '@/lib/utils';

export function MainContent({
  children,
  className,
  style,
  variant = 'default',
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  variant?: 'default' | 'forList' | 'forAgent' | 'forAgentWithHistory' | 'forWorkflow' | 'forTool' | 'forMcpsServer';
}) {
  return (
    <div
      className={cn(
        {
          // default
          'main-content_default grid overflow-y-auto h-full overflow-x-auto min-w-[min-content]': variant === 'default',
          // agent-chat screen without history
          'main-content_for-agent grid grid-cols-[1fr_1fr] overflow-x-auto': variant === 'forAgent',
          '[&>:nth-child(1)]:bg-black [&>:nth-child(1)]:py-6': variant === 'forAgent', // for clarity styles applied to the container child defined in a separate row
          // agent-chat screen with history
          'main-content_for-agent-with-history grid grid-cols-[auto_1fr_1fr] overflow-x-auto':
            variant === 'forAgentWithHistory',
          '[&>:nth-child(2)]:bg-black [&>:nth-child(2)]:py-6': variant === 'forAgentWithHistory',
          // tool screen
          'main-content_for-tool grid grid-cols-[auto_1fr] relative': variant === 'forTool',
          // MCPs server screen
          'main-content_for-mcp-server grid grid-cols-[2fr_1fr]': variant === 'forMcpsServer',
          '[&>:nth-child(2)]:border-l [&>:nth-child(1)]:border-border1': variant === 'forMcpsServer',
          // workflow/graph screen
          'main-content_for-workflow flex': variant === 'forWorkflow',
          // narrow main list
          'main-content_for-narrow-list grid px-[2rem]': variant === 'forList',
          '[&>*]:mx-auto [&>*]:grid grid [&>*]:[grid-template-columns:minmax(min-content,50rem)]':
            variant === 'forList',
        },
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}
