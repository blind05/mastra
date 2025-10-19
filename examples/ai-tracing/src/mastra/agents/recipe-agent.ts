import { Agent } from '@mastra/core/agent';
import { z } from 'zod';

// Import all input processors
import { urlValidator } from '../processors/input/url-validator';
import { imageDownloader } from '../processors/input/image-downloader';
import { imageAnalyzer } from '../processors/input/image-analyzer';
import { ingredientTranslator } from '../processors/input/ingredient-translator';

// Import all tools
import { recipeSearchTool, cookingTechniqueTool, unitConverterTool, winePairingTool } from '../tools';

/**
 * Main Recipe Agent
 * This agent demonstrates comprehensive use of Mastra features for AI tracing:
 * - Multiple input processors (both model and non-model based)
 * - Multiple tools for various recipe operations
 * - Structured output for recipe generation
 * - Multi-step reasoning with tool usage
 */

// Define structured output schema for the recipe
const recipeSchema = z.object({
  recipeName: z.string().describe('The name of the recipe in French'),
  recipeNameEnglish: z.string().describe('The name of the recipe in English'),
  cuisine: z.string().describe('The cuisine type'),
  prepTime: z.string().describe('Preparation time'),
  cookTime: z.string().describe('Cooking time'),
  servings: z.number().describe('Number of servings'),
  ingredients: z
    .array(
      z.object({
        name: z.string().describe('Ingredient name in French'),
        nameEnglish: z.string().describe('Ingredient name in English'),
        quantity: z.string().describe('Quantity needed'),
        unit: z.string().describe('Unit of measurement'),
      }),
    )
    .describe('List of ingredients with quantities'),
  instructions: z
    .array(
      z.object({
        step: z.number().describe('Step number'),
        instruction: z.string().describe('Instruction in French'),
        instructionEnglish: z.string().describe('Instruction in English'),
        technique: z.string().optional().describe('Cooking technique used'),
        duration: z.string().optional().describe('Duration for this step'),
      }),
    )
    .describe('Step-by-step cooking instructions'),
  winePairing: z
    .object({
      wine: z.string().describe('Recommended wine'),
      reason: z.string().describe('Why this wine pairs well'),
    })
    .optional()
    .describe('Wine pairing recommendation'),
  nutritionInfo: z
    .object({
      calories: z.number().optional(),
      protein: z.string().optional(),
      carbs: z.string().optional(),
      fat: z.string().optional(),
    })
    .optional()
    .describe('Nutritional information per serving'),
  chefNotes: z.string().optional().describe('Additional chef notes or tips'),
});

export const recipeAgent = new Agent({
  name: 'comprehensive-recipe-agent',
  description: 'A sophisticated culinary agent that analyzes food images and creates detailed recipes',
  instructions: `You are Chef Auguste, a world-renowned culinary expert with expertise in French cuisine.
    You analyze food images to identify ingredients and create authentic French recipes using those ingredients.

    Your process:
    1. First, examine the analyzed image data to understand the dish and ingredients
    2. Search for similar recipes to get inspiration
    3. Research proper cooking techniques for key ingredients
    4. Create a detailed recipe in French (you'll receive French translations of ingredients)
    5. Provide wine pairing suggestions
    6. Include helpful chef's tips and variations

    Use the available tools to:
    - Search for similar recipes
    - Get cooking techniques for specific ingredients
    - Convert measurements as needed
    - Suggest wine pairings

    Your recipes should be authentic, detailed, and include both traditional techniques and modern tips.
    Always reason through your choices and explain why you're making specific decisions.

    IMPORTANT: Create the recipe primarily in French, but include English translations for accessibility.`,

  model: 'openai/gpt-5-nano', // Using the requested model for reasoning

  // All our input processors will run in sequence
  inputProcessors: [
    urlValidator, // 1. Validate URLs (non-model)
    imageDownloader, // 2. Download images (non-model)
    imageAnalyzer, // 3. Analyze image with AI (model-based with structuredOutput)
    ingredientTranslator, // 4. Translate to French (model-based)
  ],

  // Tools available to the agent
  tools: {
    recipeSearchTool,
    cookingTechniqueTool,
    unitConverterTool,
    winePairingTool,
  },

  // We can define output processors here if needed, but for this demo
  // we'll apply them separately to show different approaches
});

/**
 * Alternative agent with structured output
 * This demonstrates using structuredOutput with an internal agent
 */
export const structuredRecipeAgent = new Agent({
  name: 'structured-recipe-agent',
  description: 'Agent that generates structured recipe data',
  instructions: `You are a culinary data specialist. Generate well-structured recipe information
    based on the ingredients and dish information provided. Ensure all fields are properly filled
    with accurate culinary information.`,

  model: 'openai/gpt-4o-mini',

  // This agent will use the same input processors
  inputProcessors: [urlValidator, imageDownloader, imageAnalyzer, ingredientTranslator],

  tools: {
    recipeSearchTool,
    cookingTechniqueTool,
    unitConverterTool,
    winePairingTool,
  },
});
