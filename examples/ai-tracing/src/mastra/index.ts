import { createTool, Mastra } from '@mastra/core';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { z } from "zod"
import { Agent } from "@mastra/core/agent";

export const characterGenerator = new Agent({
  name: "character-generator",
  instructions: "You generate character names for stories. Try to think of creative and unique names based on the provided story topic.",
  model: "openai/gpt-5-nano"
});

export const summaryGenerator = new Agent({
  name: "character-generator",
  instructions: "You generate summaries for stories. Use any passed information to create a unique summary.",
  model: "openai/gpt-5-nano"
});

const outlineSectionSchema = z.object({
  heading: z.string().describe("Title of the section or chapter"),
  summary: z.string().describe("Brief description of what happens in this part"),
})

const outlineSchema = z.object({
  title: z.string().describe("Title of the story"),
  sections: z.array(outlineSectionSchema)
    .min(1)
    .max(10)
    .describe("Major sections or beats of the story"),
})




export const mastra = new Mastra({
  agents: {
    characterGenerator,
    summaryGenerator,
  },
  logger: new PinoLogger({ name: 'Chef', level: 'debug' }),
  storage: new LibSQLStore({
    url: "file:./mastra.db", // Storage is required for tracing
  }),
  telemetry: {
    enabled: false,
  },
  observability: {
    default: {
      enabled: true,
    },
  },
});
