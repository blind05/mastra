import { cn } from '@/lib/utils';
import { TextAndIcon } from '@mastra/playground-ui';

import { ArrowRightIcon, MegaphoneIcon, SquareArrowOutUpRightIcon, TicketIcon } from 'lucide-react';

export function News() {
  return (
    <div className="grid gap-[1.5rem] items-start content-start">
      <h2 className="flex items-center gap-[1rem]">
        <TextAndIcon>
          <MegaphoneIcon />
          News
        </TextAndIcon>
      </h2>
      <div className="bg-black p-[2.5rem] rounded-lg text-white text-[0.875rem] overflow-hidden">
        <img src="tsaiconf-logo.png" alt="Tsai the AI" className="max-w-full mb-[2rem] rounded-lg" />
        <p className="text-icon3 leading-[1.75] text-[0.875rem]">
          The first conference for TypeScript AI developers. 300 spots. One day. Builders only. A one-day event of
          talks, code, and community all focused on building AI with TypeScript. We're done pretending Python owns it
          all. This is where the next wave shows up.
        </p>
        <a
          href="https://tsconf.ai/"
          target="_blank"
          rel="noreferrer"
          className={cn(
            'mt-[1.5rem] flex border border-accent1/75 hover:border-accent1 rounded-md w-full items-center justify-center gap-[0.5rem]  py-[0.75rem] px-[1rem] hover:bg-accent1/10 transition',
            '[&>svg]:w-[1.2em] [&>svg]:h-[1.2em] [&>svg]:opacity-75',
          )}
        >
          Get your ticket
          <SquareArrowOutUpRightIcon />
        </a>
      </div>
    </div>
  );
}
