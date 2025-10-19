import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Wine Pairing Tool
 * Suggests wine pairings for dishes and ingredients
 */
export const winePairingTool = createTool({
  id: 'wine-pairing',
  description: 'Suggest wine pairings for specific dishes or ingredients',
  inputSchema: z.object({
    dish: z.string().describe('The dish or main ingredient to pair wine with'),
    cuisine: z.string().optional().describe('The cuisine type for more accurate pairing'),
    mealCourse: z.enum(['appetizer', 'main', 'dessert', 'cheese']).optional().describe('The course of the meal'),
    priceRange: z
      .enum(['budget', 'moderate', 'premium'])
      .optional()
      .default('moderate')
      .describe('Price range for wine recommendations'),
  }),
  execute: async ({ context }) => {
    const { dish, cuisine, mealCourse, priceRange } = context;

    console.log(`[Wine Pairing Tool] Finding wine pairing for: ${dish}, cuisine: ${cuisine || 'any'}`);

    // Simulate async wine database lookup
    await new Promise(resolve => setTimeout(resolve, 400));

    // Mock wine pairing database
    const winePairings = {
      red: {
        wines: ['Cabernet Sauvignon', 'Merlot', 'Pinot Noir', 'Malbec', 'Syrah/Shiraz'],
        characteristics: 'Full-bodied with tannins, pairs well with red meats and hearty dishes',
        servingTemp: '60-68°F (15-20°C)',
        regions: ['Bordeaux', 'Napa Valley', 'Tuscany', 'Mendoza'],
      },
      white: {
        wines: ['Chardonnay', 'Sauvignon Blanc', 'Pinot Grigio', 'Riesling', 'Albariño'],
        characteristics: 'Light to medium-bodied, pairs well with seafood, poultry, and light dishes',
        servingTemp: '45-55°F (7-13°C)',
        regions: ['Burgundy', 'Loire Valley', 'Marlborough', 'Mosel'],
      },
      rosé: {
        wines: ['Provence Rosé', 'White Zinfandel', 'Rosé of Pinot Noir'],
        characteristics: 'Light and refreshing, versatile pairing for salads and light fare',
        servingTemp: '45-55°F (7-13°C)',
        regions: ['Provence', 'California', 'Spain'],
      },
      sparkling: {
        wines: ['Champagne', 'Prosecco', 'Cava', 'Crémant'],
        characteristics: 'Effervescent and celebratory, excellent as aperitif or with light dishes',
        servingTemp: '40-50°F (4-10°C)',
        regions: ['Champagne', 'Veneto', 'Catalonia'],
      },
      dessert: {
        wines: ['Port', 'Sauternes', 'Ice Wine', 'Moscato'],
        characteristics: 'Sweet wines perfect for desserts or cheese courses',
        servingTemp: '55-65°F (13-18°C)',
        regions: ['Porto', 'Bordeaux', 'Canada', 'Piedmont'],
      },
    };

    // Determine best wine category based on dish and course
    let recommendedCategory;
    let specificPairings = [];

    // Simple heuristic for wine selection (would be more sophisticated in production)
    const dishLower = dish.toLowerCase();
    if (mealCourse === 'dessert') {
      recommendedCategory = winePairings.dessert;
      specificPairings = ['Port with chocolate', 'Moscato with fruit desserts', 'Ice Wine with pastries'];
    } else if (dishLower.includes('beef') || dishLower.includes('steak') || dishLower.includes('lamb')) {
      recommendedCategory = winePairings.red;
      specificPairings = ['Cabernet Sauvignon for grilled meats', 'Malbec for spiced preparations'];
    } else if (dishLower.includes('fish') || dishLower.includes('seafood') || dishLower.includes('chicken')) {
      recommendedCategory = winePairings.white;
      specificPairings = ['Sauvignon Blanc for light fish', 'Chardonnay for creamy sauces'];
    } else if (mealCourse === 'appetizer') {
      recommendedCategory = winePairings.sparkling;
      specificPairings = ['Champagne as aperitif', 'Prosecco with light starters'];
    } else {
      // Default to rosé for versatility
      recommendedCategory = winePairings.rosé;
      specificPairings = ['Provence Rosé for Mediterranean dishes', 'Versatile pairing'];
    }

    // Price recommendations
    const priceGuide = {
      budget: { range: '$10-20', suggestion: 'Look for wines from emerging regions' },
      moderate: { range: '$20-50', suggestion: 'Classic producers offer great value' },
      premium: { range: '$50+', suggestion: 'Premier crus and reserve selections' },
    };

    // Add cuisine-specific recommendations
    let cuisineNote = '';
    if (cuisine) {
      const cuisineLower = cuisine.toLowerCase();
      if (cuisineLower.includes('french')) {
        cuisineNote = 'Consider classic French wines from the same region as the dish';
      } else if (cuisineLower.includes('italian')) {
        cuisineNote = 'Italian wines like Chianti or Barolo complement Italian cuisine beautifully';
      } else if (cuisineLower.includes('asian')) {
        cuisineNote = 'Off-dry Riesling or Gewürztraminer work well with spicy Asian dishes';
      }
    }

    console.log(`[Wine Pairing Tool] Recommended ${recommendedCategory.wines[0]} and alternatives`);

    return {
      dish,
      cuisine: cuisine || 'International',
      recommendedWines: recommendedCategory.wines,
      characteristics: recommendedCategory.characteristics,
      servingTemperature: recommendedCategory.servingTemp,
      topRegions: recommendedCategory.regions,
      specificPairings,
      priceRange: priceRange || 'moderate',
      priceGuide: priceGuide[priceRange || 'moderate'],
      cuisineNote,
      sommelierTip: `For ${dish}, I recommend ${recommendedCategory.wines[0]} as it ${
        specificPairings[0] ? specificPairings[0].toLowerCase() : 'pairs beautifully with this dish'
      }. The wine's ${recommendedCategory.characteristics.toLowerCase()}.`,
    };
  },
});
