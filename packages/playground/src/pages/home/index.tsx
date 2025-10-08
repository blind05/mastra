import { cn } from '@/lib/utils';
import { MainContent, MainLayout, PageHeader } from '@mastra/playground-ui';
import { LayoutDashboardIcon } from 'lucide-react';
import { Traces, type RecentlyActiveEntity } from './traces';
import { Agents } from './agents';
import { Workflows } from './workflows';
import { News } from './news';
import { useState } from 'react';
import { Scores } from './scores';

export default function Home() {
  const [recentlyActiveAgents, setRecentlyActiveAgents] = useState<RecentlyActiveEntity[]>([]);
  const [recentlyActiveWorkflows, setRecentlyActiveWorkflows] = useState<RecentlyActiveEntity[]>([]);

  const onTracesLoad = (entities: RecentlyActiveEntity[]) => {
    const agents = entities.filter(e => e.type === 'agent').slice(0, 5);
    const workflows = entities.filter(e => e.type === 'workflow').slice(0, 5);

    setRecentlyActiveAgents(agents);
    setRecentlyActiveWorkflows(workflows);
  };

  return (
    <MainLayout>
      <MainContent>
        <div className={cn('max-w-[100rem] w-full px-[3rem] mx-auto grid content-start gap-[2rem] h-full')}>
          <PageHeader title="Dashboard" icon={<LayoutDashboardIcon />} />
          <div
            className={cn(
              'grid content-start pb-[3rem]',
              'xl:grid-cols-[20rem_1fr] xl:gap-[3rem]',
              '2xl:grid-cols-[30rem_1fr] 2xl:gap-[5rem]',
            )}
          >
            <div className="grid gap-[3rem] content-start">
              <News />
              <Agents recentlyActive={recentlyActiveAgents} />
              <Workflows recentlyActive={recentlyActiveWorkflows} />
            </div>
            <div className="grid gap-[3rem] content-start">
              <Traces onLoad={onTracesLoad} />
              <Scores />
            </div>
          </div>
        </div>
      </MainContent>
    </MainLayout>
  );
}
