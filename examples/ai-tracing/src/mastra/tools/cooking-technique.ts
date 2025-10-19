import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Cooking Technique Tool
 * Provides cooking techniques and methods for specific ingredients
 */
export const cookingTechniqueTool = createTool({
  id: 'cooking-technique',
  description: 'Get cooking techniques and methods for specific ingredients or dishes',
  inputSchema: z.object({
    ingredient: z.string().describe('The ingredient or dish to get cooking techniques for'),
    preferredMethod: z
      .enum(['grilling', 'baking', 'frying', 'steaming', 'roasting', 'sauteing', 'braising', 'any'])
      .optional()
      .default('any')
      .describe('Preferred cooking method'),
  }),
  execute: async ({ context }) => {
    const { ingredient, preferredMethod } = context;

    console.log(`[Cooking Technique Tool] Getting techniques for: ${ingredient}, method: ${preferredMethod}`);

    // Simulate async processing
    await new Promise(resolve => setTimeout(resolve, 300));

    // Mock cooking techniques database
    const techniques = {
      grilling: {
        temperature: '400-450°F (200-230°C)',
        time: '4-6 minutes per side',
        tips: [
          'Preheat grill properly',
          'Oil the grates to prevent sticking',
          "Don't flip too frequently",
          'Use a meat thermometer for accuracy',
        ],
        bestFor: ['meats', 'vegetables', 'seafood'],
      },
      baking: {
        temperature: '350-375°F (175-190°C)',
        time: '20-45 minutes depending on size',
        tips: [
          'Preheat oven before baking',
          'Use middle rack for even cooking',
          "Don't open oven door frequently",
          'Test doneness with a toothpick',
        ],
        bestFor: ['casseroles', 'breads', 'desserts', 'roasted vegetables'],
      },
      frying: {
        temperature: '350-375°F (175-190°C) oil temperature',
        time: '3-5 minutes until golden',
        tips: [
          "Don't overcrowd the pan",
          'Maintain consistent oil temperature',
          'Pat ingredients dry before frying',
          'Use a thermometer for oil temperature',
        ],
        bestFor: ['proteins', 'vegetables', 'dough-based items'],
      },
      steaming: {
        temperature: '212°F (100°C) - boiling water',
        time: '5-15 minutes',
        tips: [
          "Don't let water touch the food",
          'Keep lid on during steaming',
          'Check water levels periodically',
          'Season after steaming for best flavor',
        ],
        bestFor: ['vegetables', 'fish', 'dumplings', 'rice'],
      },
      roasting: {
        temperature: '400-425°F (200-220°C)',
        time: '30-60 minutes',
        tips: [
          'Use high heat for crispy exterior',
          'Turn ingredients halfway through',
          "Don't overcrowd the pan",
          'Let meat rest after roasting',
        ],
        bestFor: ['large cuts of meat', 'whole vegetables', 'poultry'],
      },
      sauteing: {
        temperature: 'Medium-high heat',
        time: '3-7 minutes',
        tips: [
          'Heat pan before adding oil',
          'Keep ingredients moving',
          'Cut ingredients uniformly',
          "Don't overcrowd the pan",
        ],
        bestFor: ['vegetables', 'small protein pieces', 'aromatics'],
      },
      braising: {
        temperature: '325-350°F (160-175°C)',
        time: '1-3 hours',
        tips: [
          'Brown meat first for flavor',
          'Use enough liquid to partially cover',
          'Keep covered during cooking',
          'Low and slow for tender results',
        ],
        bestFor: ['tough cuts of meat', 'root vegetables', 'stews'],
      },
    };

    // Select appropriate technique
    let selectedTechnique;
    if (preferredMethod && preferredMethod !== 'any' && techniques[preferredMethod]) {
      selectedTechnique = techniques[preferredMethod];
    } else {
      // Randomly select a technique for variety
      const methods = Object.keys(techniques);
      const randomMethod = methods[Math.floor(Math.random() * methods.length)];
      selectedTechnique = techniques[randomMethod as keyof typeof techniques];
    }

    // Add specific advice for the ingredient
    const specificAdvice = `For ${ingredient}: ${selectedTechnique.tips[0]}. This method works particularly well because it ${
      preferredMethod === 'steaming'
        ? 'preserves nutrients and natural flavors'
        : preferredMethod === 'grilling'
          ? 'adds smoky flavor and nice char marks'
          : preferredMethod === 'frying'
            ? 'creates a crispy exterior while keeping interior moist'
            : 'enhances the natural flavors of the ingredient'
    }.`;

    console.log(`[Cooking Technique Tool] Recommending ${preferredMethod || 'various'} technique(s)`);

    return {
      ingredient,
      recommendedMethod: preferredMethod || 'various',
      technique: selectedTechnique,
      specificAdvice,
      alternativeMethods: Object.keys(techniques).filter(m => m !== preferredMethod),
    };
  },
});
