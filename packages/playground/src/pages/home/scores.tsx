import { EntryList, EntryListStatusCell, TextAndIcon, useScorer, useScoresByScorerId } from '@mastra/playground-ui';
import { useEffect, useState } from 'react';
import { useAITraces } from '@/domains/observability/hooks/use-ai-traces';
import { format, isToday } from 'date-fns';
import { GaugeIcon } from 'lucide-react';
import { useScorers } from '@mastra/playground-ui';
import scorer from '../scorers/scorer';

const listColumns = [
  { name: 'date', label: 'Date', size: '5rem' },
  { name: 'time', label: 'Time', size: '5rem' },
  { name: 'input', label: 'Input', size: '1fr' },
  { name: 'entityId', label: 'Entity', size: '10rem' },
  { name: 'score', label: 'Score', size: '2.5rem' },
];

type ScoreItem = {
  id: string;
  date: string;
  time: string;
  input: string;
  entityId: string;
  score: number;
};

export type RecentlyActiveEntity = {
  name: string;
  type: 'workflow' | 'agent';
  date: Date;
};

type ScoresProps = {};

export function Scores({}: ScoresProps) {
  const [selectedTraceId, setSelectedTraceId] = useState<string | undefined>();

  const { scorers, isLoading } = useScorers();

  const scorerListData = Object.entries(scorers || {}).map(([key, scorer]) => ({
    id: key,
    name: scorer.scorer.config.name,
    description: scorer.scorer.config.description,
  }));

  const { scores: scoresData0, isLoading: scores0Loading } = useScoresByScorerId({
    scorerId: scorerListData?.[0]?.id,
  });

  const { scores: scoresData1, isLoading: scores1Loading } = useScoresByScorerId({
    scorerId: scorerListData?.[1]?.id,
  });

  const scores = [...(scoresData0?.scores || []), ...(scoresData1?.scores || [])];
  const scoresLoading = scores0Loading || scores1Loading;

  const items: ScoreItem[] = scores
    .map(score => {
      const createdAtDate = new Date(score.createdAt);
      const isTodayDate = isToday(createdAtDate);

      return {
        id: score.id,
        date: isTodayDate ? 'Today' : format(createdAtDate, 'MMM dd'),
        time: format(createdAtDate, 'HH:mm:ss'),
        input: score?.input?.inputMessages?.[0]?.content || '',
        entityId: score.entityId,
        score: score.score,
      };
    })
    .filter((_, idx) => idx < 5);

  const handleOnListItem = (id: string) => {
    if (id === selectedTraceId) {
      return setSelectedTraceId(undefined);
    }

    setSelectedTraceId(id);
  };

  console.log();

  return (
    <div className="grid gap-[1.5rem] items-start content-start">
      <h2 className="flex items-center gap-[1rem]">
        <TextAndIcon>
          <GaugeIcon /> Recent Scores
        </TextAndIcon>
      </h2>
      <EntryList
        items={items}
        selectedItemId={selectedTraceId}
        onItemClick={handleOnListItem}
        columns={listColumns}
        isLoading={scoresLoading}
      />
    </div>
  );
}
