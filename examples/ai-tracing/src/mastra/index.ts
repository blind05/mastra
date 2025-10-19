import { Mastra } from '@mastra/core';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { recipeAgent, structuredRecipeAgent } from './agents/index';

const storage = new LibSQLStore({
  url: 'file:./mastra.db',
});

export const mastra = new Mastra({
  agents: {
    recipeAgent,
    structuredRecipeAgent,
  },
  logger: new PinoLogger({ name: 'Chef', level: 'debug' }),
  storage,
  telemetry: {
    enabled: false,
  },
  observability: {
    default: {
      enabled: true,
    },
  },
});
