import { createTool, Mastra } from '@mastra/core';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { z } from "zod"
import { Agent } from "@mastra/core/agent";
import { UnicodeNormalizer, PromptInjectionDetector } from "@mastra/core/processors";
import { openai } from '@ai-sdk/openai-v5';



const characterAgent = new Agent({
  name: "character-agent",
  instructions: "Generate a single character name for a short story based on the character description",
  model: "openai/gpt-4.1-nano"
});

const summaryAgent = new Agent({
  name: "character-agent",
  instructions: "Generate a summary for a unique and creative short story using any passed info.",
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

const randomIntegerTool = createTool({
  id: "randomIntegerTool",
  description: "Returns a random integer between 2 and 5 (inclusive).",
  outputSchema: z.object({
    value: z.number()
      .describe("Random integer between 2 and 5"),
  }),
  execute: async () => {
    const value = Math.floor(Math.random() * 4) + 2
    return { value }
  },
})

const charNameSchema = z.object({
  name: z.string().describe("the name of the character"),
})

const characterTool = createTool({
  id: "characterTool",
  description: "Calls the characterAgent to create a character name",
  inputSchema: z.object({
    description: z.string().describe("short description of the character to name"),
  }),
  outputSchema: charNameSchema,
  execute: async ({ context, mastra, tracingContext }) => {
    const charAgent = mastra?.getAgent("characterAgent");
    const result = characterAgent.generate(`generate a character for this description: ${context.description}`, { structuredOutput: { schema: charNameSchema }, tracingContext});
    return (await result).object
  },
})


const storyAgent = new Agent({
  name: "story-agent",
  instructions: "Generate a short story using the provided tools. Use the random integer tool to determine how many characters to generate. Be lazy about generating character names, only generate them immediately before you use them.",
  model: "openai/gpt-5-nano",
  inputProcessors: [
    new UnicodeNormalizer({
      stripControlChars: true,
      collapseWhitespace: true,
    }),
    // new PromptInjectionDetector({
    //   model: openai("gpt-4.1-nano"),
    //   threshold: 0.8,
    //   strategy: 'rewrite',
    //   detectionTypes: ['injection', 'jailbreak', 'system-override'],
    // })
  ],
  tools: {
    characterTool,
    randomIntegerTool,
  },
})


export const mastra = new Mastra({
  agents: {
    characterAgent,
    summaryAgent,
    storyAgent,
  },
  logger: new PinoLogger({ level: 'info' }),
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
