import { EntryList, EntryListStatusCell, TextAndIcon } from '@mastra/playground-ui';
import { useEffect, useState } from 'react';
import { useAITraces } from '@/domains/observability/hooks/use-ai-traces';
import { format, isToday } from 'date-fns';
import { EyeIcon } from 'lucide-react';

const listColumns = [
  { name: 'date', label: 'Date', size: '5rem' },
  { name: 'time', label: 'Time', size: '5rem' },
  { name: 'name', label: 'Name', size: '1fr' },
  { name: 'entityId', label: 'Entity', size: '10rem' },
  { name: 'status', label: 'Status', size: '2.5rem' },
];

type TraceItem = {
  id: string;
  date: string;
  time: string;
  name: string;
};

export type RecentlyActiveEntity = {
  name: string;
  type: 'workflow' | 'agent';
  date: Date;
};

type TracesProps = {
  onLoad: (entities: RecentlyActiveEntity[]) => void;
};

export function Traces({ onLoad }: TracesProps) {
  const [selectedTraceId, setSelectedTraceId] = useState<string | undefined>();
  const [recentlyActiveEntities, setRecentlyActiveEntities] = useState<RecentlyActiveEntity[]>([]);

  const {
    data: aiTraces = [],
    isLoading,
    error,
    isError,
    isRefetching,
  } = useAITraces({
    filters: undefined,
    dateRange: undefined,
  });

  // useEffect(() => {
  //   const timeout = setInterval(() => {
  //     refetch();
  //   }, 3000);

  //   return () => {
  //     clearInterval(timeout);
  //   };
  // }, []);

  useEffect(() => {
    if (!isLoading && !isRefetching && aiTraces.length > 0) {
      const recentEntities: RecentlyActiveEntity[] = aiTraces
        .map(trace => {
          const entityId = trace?.attributes?.agentId || trace?.attributes?.workflowId;
          const entityType = trace?.attributes?.agentId
            ? 'agent'
            : trace?.attributes?.workflowId
              ? 'workflow'
              : undefined;
          if (!entityId || !entityType) {
            return undefined;
          }
          return {
            name: entityId,
            type: entityType,
            date: trace.createdAt,
          } as RecentlyActiveEntity;
        })
        .filter((item): item is RecentlyActiveEntity => item !== undefined);
      const uniqueRecentEntities = recentEntities.filter(
        (item, index, array) => array.findIndex(i => i.name === item.name && i.type === item.type) === index,
      );

      if (JSON.stringify(uniqueRecentEntities) === JSON.stringify(recentlyActiveEntities)) {
        return;
      }

      setRecentlyActiveEntities(uniqueRecentEntities);
      onLoad(uniqueRecentEntities);
    }
  }, [aiTraces, recentlyActiveEntities]);

  const items: TraceItem[] = aiTraces
    .map(trace => {
      const createdAtDate = new Date(trace.createdAt);
      const isTodayDate = isToday(createdAtDate);

      return {
        id: trace.traceId,
        date: isTodayDate ? 'Today' : format(createdAtDate, 'MMM dd'),
        time: format(createdAtDate, 'HH:mm:ss'),
        name: trace?.name,
        entityId: trace?.attributes?.agentId || trace?.attributes?.workflowId,
        status: <EntryListStatusCell status={trace?.attributes?.status} key={`${trace?.traceId}-status`} />,
      };
    })
    .filter((_, idx) => idx < 5);

  const handleOnListItem = (id: string) => {
    if (id === selectedTraceId) {
      return setSelectedTraceId(undefined);
    }

    setSelectedTraceId(id);
  };

  return (
    <div className="grid gap-[1.5rem] items-start content-start">
      <h2 className="flex items-center gap-[1rem]">
        <TextAndIcon>
          <EyeIcon /> Recent Observability Traces
        </TextAndIcon>
      </h2>
      <EntryList
        items={items}
        selectedItemId={selectedTraceId}
        onItemClick={handleOnListItem}
        columns={listColumns}
        isLoading={isLoading}
        errorMsg={isError ? error.message : undefined}
      />
    </div>
  );
}
