import { useScorers } from '@/domains/scores/hooks/use-scorers';
import { Button } from '@/components/ui/elements/buttons';
import { InfoIcon } from 'lucide-react';
import { useTriggerScorer } from '@/domains/scores/hooks/use-trigger-scorer';
import { AISpanRecord } from '@mastra/core';
import { Notification, SelectField, TextAndIcon } from '@/components/ui/elements';
import { useEffect, useState } from 'react';

export interface TraceScoringProps {
  trace: AISpanRecord;
  spanId?: string;
  onScorerTriggered: (scorerName: string, traceId: string, spanId?: string) => void;
  entityType?: string;
}

export const TraceScoring = ({ trace, spanId, onScorerTriggered, entityType }: TraceScoringProps) => {
  const { data: scorers = {}, isLoading } = useScorers();
  const [selectedScorer, setSelectedScorer] = useState<string | null>(null);
  const { mutate: triggerScorer, isPending, isSuccess } = useTriggerScorer(onScorerTriggered);
  const [notificationIsVisible, setNotificationIsVisible] = useState(false);

  useEffect(() => {
    if (isSuccess) {
      setNotificationIsVisible(true);
    }
  }, [isSuccess]);

  let scorerList = Object.entries(scorers)
    .map(([key, scorer]) => ({
      id: key,
      name: scorer.scorer.config.name,
      description: scorer.scorer.config.description,
      isRegistered: scorer.isRegistered,
      type: scorer.scorer.config.type,
    }))
    .filter(scorer => scorer.isRegistered);

  // Filter out Scorers with type agent if we are not scoring on a top level agent generated span
  if (entityType !== 'Agent' || spanId) {
    scorerList = scorerList.filter(scorer => scorer.type !== 'agent');
  }

  const isWaiting = isPending || isLoading;

  const handleStartScoring = () => {
    if (selectedScorer) {
      triggerScorer({ scorerName: selectedScorer, traceId: trace.traceId, spanId });
      //  setSelectedScorer(null);
    }
  };

  const handleScorerChange = (val: string) => {
    setSelectedScorer(val);
    setNotificationIsVisible(false);
  };

  const selectedScorerDescription = scorerList.find(s => s.name === selectedScorer)?.description || '';

  return (
    <div>
      <div className="grid grid-cols-[3fr_1fr] gap-[1rem] items-start">
        <div className="grid gap-[0.5rem]">
          <SelectField
            name={'select-scorer'}
            placeholder="Select a scorer..."
            options={scorerList.map(scorer => ({ label: scorer.name, value: scorer.name }))}
            onValueChange={handleScorerChange}
            value={selectedScorer || ''}
            className="min-w-[20rem]"
            disabled={isWaiting}
          />
          {selectedScorerDescription && (
            <TextAndIcon className="text-icon3">
              <InfoIcon /> {selectedScorerDescription}
            </TextAndIcon>
          )}
        </div>

        <Button disabled={!selectedScorer || isWaiting} onClick={handleStartScoring}>
          {isPending ? 'Starting...' : 'Start Scoring'}
        </Button>
      </div>

      <Notification isVisible={notificationIsVisible} className="mt-[1rem]">
        <InfoIcon /> Scorer triggered! When finished successfully, it will appear in the list below. It could take a
        moment.
      </Notification>
    </div>
  );
};
