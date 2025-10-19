import type { InputProcessor } from '@mastra/core/processors';
import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import * as fs from 'fs/promises';

// Define the structured output schema for ingredients
const ingredientsSchema = z.object({
  dishName: z.string().describe('The name of the dish in the image'),
  cuisine: z.string().describe('The type of cuisine (e.g., Italian, Mexican, Asian)'),
  ingredients: z
    .array(
      z.object({
        name: z.string().describe('Name of the ingredient'),
        quantity: z.string().optional().describe('Estimated quantity if visible'),
        category: z
          .enum(['protein', 'vegetable', 'grain', 'dairy', 'spice', 'sauce', 'other'])
          .describe('Category of the ingredient'),
      }),
    )
    .describe('List of visible ingredients in the dish'),
  cookingMethod: z.string().optional().describe('Apparent cooking method (e.g., grilled, baked, fried)'),
  servings: z.number().optional().describe('Estimated number of servings'),
});

type IngredientsData = z.infer<typeof ingredientsSchema>;

// Create an internal agent for image analysis with structured output
const imageAnalyzerAgent = new Agent({
  name: 'image-analyzer-agent',
  instructions: `You are an expert culinary analyst who can identify ingredients and dishes from images.
    Analyze the provided food image and extract all visible ingredients, the dish name, and cooking method.
    Be specific and detailed in your analysis. If you're not certain about an ingredient, make your best educated guess based on visual cues.`,
  model: 'openai/gpt-4o',
});

/**
 * Image Analyzer Input Processor
 * Model-based processor that analyzes food images and extracts structured ingredient data
 */
export const imageAnalyzer: InputProcessor = {
  name: 'image-analyzer',
  processInput: async ({ messages }) => {
    for (const message of messages) {
      if (message.role === 'user') {
        for (const part of message.content.parts) {
          if (part.type === 'text') {
            // Look for local image paths
            const imagePathPattern = /\[Image downloaded to: ([^\]]+)\]/g;
            const matches = [...part.text.matchAll(imagePathPattern)];

            for (const match of matches) {
              const imagePath = match[1];

              try {
                // Read the image file
                const imageBuffer = await fs.readFile(imagePath);
                const base64Image = imageBuffer.toString('base64');
                const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

                console.log(`[Image Analyzer] Analyzing image: ${imagePath}`);

                // Use the agent to analyze the image with structured output
                const response = await imageAnalyzerAgent.generate(
                  [
                    {
                      role: 'user',
                      content: [
                        {
                          type: 'text',
                          text: 'Please analyze this food image and identify all visible ingredients, the dish name, and cooking method.',
                        },
                        {
                          type: 'image',
                          image: `data:${mimeType};base64,${base64Image}`,
                        },
                      ],
                    },
                  ],
                  {
                    structuredOutput: {
                      schema: ingredientsSchema,
                    },
                  },
                );

                // Extract the structured data
                const analysisResult = response.object as IngredientsData | undefined;

                if (!analysisResult) {
                  throw new Error('No analysis result returned');
                }

                console.log(`[Image Analyzer] Analysis complete:`, analysisResult);

                // Format the analysis result and append to the message
                const formattedAnalysis = `
[Image Analysis Results]
Dish: ${analysisResult.dishName}
Cuisine: ${analysisResult.cuisine}
Cooking Method: ${analysisResult.cookingMethod || 'Not determined'}
Estimated Servings: ${analysisResult.servings || 'Not determined'}

Identified Ingredients:
${analysisResult.ingredients
  .map((ing: any) => `- ${ing.name} (${ing.category})${ing.quantity ? ` - ${ing.quantity}` : ''}`)
  .join('\n')}

[Raw Analysis Data]: ${JSON.stringify(analysisResult)}
                `;

                // Append the analysis to the message
                part.text += formattedAnalysis;
              } catch (error) {
                console.error(`[Image Analyzer] Failed to analyze image ${imagePath}:`, error);
                part.text += `\n[Image analysis failed for: ${imagePath}]`;
              }
            }
          }
        }
      }
    }

    return messages;
  },
};
