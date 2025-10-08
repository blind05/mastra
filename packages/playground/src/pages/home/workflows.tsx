import { EntryList, TextAndIcon, WorkflowIcon } from '@mastra/playground-ui';
import { useWorkflows } from '@/hooks/use-workflows';
import { type RecentlyActiveEntity } from './traces';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';

const listColumns = [
  { name: 'name', label: 'Name', size: '1fr' },
  { name: 'date', label: 'Active', size: '10rem' },
];

type WorkflowItem = {
  id: string;
  name: string;
  date: string;
};

type WorkflowsProps = {
  recentlyActive: RecentlyActiveEntity[];
};

export function Workflows({ recentlyActive }: WorkflowsProps) {
  const { data: workflows, isLoading } = useWorkflows();
  const legacy = workflows?.[0] || {};
  const current = workflows?.[1] || {};

  const items: WorkflowItem[] = (recentlyActive || [])
    .map(entity => ({
      id: entity.name,
      name: entity.name,
      date: formatDistanceToNow(entity.date, { addSuffix: true }),
    }))
    .filter((_, idx) => idx < 3);

  if (recentlyActive.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-[1.5rem] items-start content-start">
      <h2 className="flex items-center gap-[1rem]">
        <TextAndIcon>
          <WorkflowIcon />
          Recently Active Workflows
        </TextAndIcon>
      </h2>
      <EntryList items={items} columns={listColumns} isLoading={isLoading} />
    </div>
  );
}
