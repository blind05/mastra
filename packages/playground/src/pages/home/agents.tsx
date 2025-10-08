import { AgentIcon, EntryList, TextAndIcon } from '@mastra/playground-ui';
import { useAgents } from '@/hooks/use-agents';
import { type RecentlyActiveEntity } from './traces';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';

const listColumns = [
  { name: 'name', label: 'Name', size: '1fr' },
  { name: 'date', label: 'Active', size: '10rem' },
];

type AgentItem = {
  id: string;
  name: string;
  date: string;
};

type AgentsProps = {
  recentlyActive: RecentlyActiveEntity[];
};

export function Agents({ recentlyActive }: AgentsProps) {
  const { data: agents, isLoading } = useAgents();

  const items: AgentItem[] = (recentlyActive || [])
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
          <AgentIcon />
          Recently Active Agents
        </TextAndIcon>
      </h2>
      <EntryList items={items} columns={listColumns} isLoading={isLoading} />
    </div>
  );
}
