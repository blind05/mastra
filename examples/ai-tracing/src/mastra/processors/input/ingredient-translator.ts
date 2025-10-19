import type { InputProcessor } from '@mastra/core/processors';
import { Agent } from '@mastra/core/agent';

// Create an internal agent for translation
const translatorAgent = new Agent({
  name: 'ingredient-translator-agent',
  instructions: `You are a culinary translator specializing in food terminology.
    Translate ingredient names and culinary terms from English to French.
    Maintain culinary accuracy and use proper French cooking terminology.
    Preserve quantities and measurements in the original format.`,
  model: 'openai/gpt-4o-mini',
});

/**
 * Ingredient Translator Input Processor
 * Model-based processor that translates ingredients from English to French
 */
export const ingredientTranslator: InputProcessor = {
  name: 'ingredient-translator',
  processInput: async ({ messages }) => {
    for (const message of messages) {
      if (message.role === 'user') {
        for (const part of message.content.parts) {
          if (part.type === 'text') {
            // Look for the raw analysis data
            const rawDataPattern = /\[Raw Analysis Data\]: ({.*?})\n/s;
            const match = part.text.match(rawDataPattern);

            if (match) {
              try {
                const analysisData = JSON.parse(match[1]);

                console.log(`[Ingredient Translator] Translating ingredients to French`);

                // Create a translation request for the ingredients
                const ingredientsList = analysisData.ingredients
                  .map((ing: any) => `${ing.name} (${ing.category})`)
                  .join('\n');

                const translationResponse = await translatorAgent.generate(
                  `Please translate the following ingredients and dish information to French. Maintain the format and structure:

Dish Name: ${analysisData.dishName}
Cuisine Type: ${analysisData.cuisine}
Cooking Method: ${analysisData.cookingMethod || 'Not specified'}

Ingredients:
${ingredientsList}

Provide the translation in this exact format:
Dish Name (French): [translation]
Cuisine Type (French): [translation]
Cooking Method (French): [translation]

Ingredients (French):
[ingredient translations, one per line]`,
                );

                const translatedContent = translationResponse.text;

                console.log(`[Ingredient Translator] Translation complete`);

                // Append the French translation to the message
                const frenchSection = `

[French Translation]
${translatedContent}

[Translation Complete]`;

                part.text += frenchSection;

                // Also add a structured version for easier parsing
                const structuredFrench = {
                  dishNameFr: translatedContent.match(/Dish Name \(French\): (.+)/)?.[1] || analysisData.dishName,
                  cuisineFr: translatedContent.match(/Cuisine Type \(French\): (.+)/)?.[1] || analysisData.cuisine,
                  cookingMethodFr:
                    translatedContent.match(/Cooking Method \(French\): (.+)/)?.[1] || analysisData.cookingMethod,
                  ingredientsFr:
                    translatedContent
                      .split('Ingredients (French):')[1]
                      ?.trim()
                      .split('\n')
                      .filter((line: string) => line.trim())
                      .map((line: string) => line.trim()) || [],
                };

                part.text += `\n[Structured French Data]: ${JSON.stringify(structuredFrench)}`;
              } catch (error) {
                console.error(`[Ingredient Translator] Failed to translate:`, error);
                part.text += `\n[Translation failed]`;
              }
            }
          }
        }
      }
    }

    return messages;
  },
};
