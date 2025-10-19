import { Agent } from '@mastra/core/agent';

/**
 * Recipe Translator Output Processor
 * Model-based processor that translates French recipes back to English
 * This uses an internal agent to perform the translation
 */

// Create an internal agent for recipe translation
const recipeTranslatorAgent = new Agent({
  name: 'recipe-translator-output-agent',
  instructions: `You are a culinary translator specializing in recipe translation.
    Translate recipes from French to English while maintaining culinary terminology accuracy.
    Preserve the recipe structure, measurements, and cooking instructions.`,
  model: 'openai/gpt-4o-mini',
});

/**
 * Custom output processor that translates recipe content from French to English
 * This demonstrates a model-based output processor
 */
export const recipeTranslatorProcessor = {
  name: 'recipe-translator-output',
  process: async (text: string) => {
    console.log('[Recipe Translator Output] Translating recipe from French to English');

    try {
      // Use the agent to translate the recipe
      const response = await recipeTranslatorAgent.generate(
        `Please translate the following French recipe to English. Maintain the structure and formatting:\n\n${text}`,
      );

      console.log('[Recipe Translator Output] Translation complete');
      return response.text;
    } catch (error) {
      console.error('[Recipe Translator Output] Translation failed:', error);
      return text; // Return original text if translation fails
    }
  },
};
