import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Recipe Search Tool
 * Searches for similar recipes online (mocked for demo)
 */
export const recipeSearchTool = createTool({
  id: 'recipe-search',
  description: 'Search for similar recipes based on ingredients or dish name',
  inputSchema: z.object({
    query: z.string().describe('Search query - can be dish name or ingredients'),
    cuisine: z.string().optional().describe('Specific cuisine type to filter by'),
    maxResults: z.number().optional().default(3).describe('Maximum number of results to return'),
  }),
  execute: async ({ context }) => {
    const { query, cuisine, maxResults } = context;

    console.log(`[Recipe Search Tool] Searching for: ${query}, cuisine: ${cuisine || 'any'}`);

    // Simulate async API call delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Mock recipe search results
    const mockRecipes = [
      {
        title: `Classic ${query} Recipe`,
        cuisine: cuisine || 'International',
        prepTime: '30 minutes',
        cookTime: '45 minutes',
        difficulty: 'Medium',
        ingredients: [
          'Main ingredients similar to your query',
          'Traditional spices and herbs',
          'Fresh vegetables',
          'Quality proteins',
        ],
        instructions: ['Prepare all ingredients', 'Follow traditional cooking methods', 'Season to taste', 'Serve hot'],
        rating: 4.5,
        source: 'ChefDatabase.com',
      },
      {
        title: `Modern ${query} Fusion`,
        cuisine: `${cuisine || 'Contemporary'} Fusion`,
        prepTime: '25 minutes',
        cookTime: '35 minutes',
        difficulty: 'Easy',
        ingredients: ['Innovative ingredient combinations', 'Modern cooking techniques', 'Fusion elements'],
        instructions: [
          'Use modern preparation methods',
          'Combine flavors creatively',
          'Plate with artistic presentation',
        ],
        rating: 4.7,
        source: 'ModernCuisine.org',
      },
      {
        title: `Traditional ${cuisine || 'Regional'} ${query}`,
        cuisine: cuisine || 'Traditional',
        prepTime: '45 minutes',
        cookTime: '60 minutes',
        difficulty: 'Hard',
        ingredients: ['Authentic regional ingredients', 'Traditional spice blends', 'Heritage vegetables'],
        instructions: [
          'Follow time-honored techniques',
          'Use traditional cookware if available',
          'Allow flavors to develop slowly',
        ],
        rating: 4.8,
        source: 'AuthenticRecipes.net',
      },
    ];

    const results = mockRecipes.slice(0, maxResults || 3);

    console.log(`[Recipe Search Tool] Found ${results.length} recipes`);

    return {
      success: true,
      resultsCount: results.length,
      recipes: results,
      searchQuery: query,
      cuisine: cuisine,
    };
  },
});
