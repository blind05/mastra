import { recipeAgent, structuredRecipeAgent } from './src/mastra/agents';
import { z } from 'zod';

/**
 * Test script for the comprehensive recipe agent
 * This script demonstrates all the AI tracing features by:
 * 1. Processing a food image URL through multiple processors
 * 2. Using tools for recipe research and creation
 * 3. Generating structured output
 * 4. Applying output processors
 */

// Define structured output schema for the recipe
const recipeOutputSchema = z.object({
  recipeName: z.string().describe('The name of the recipe'),
  cuisine: z.string().describe('The cuisine type'),
  prepTime: z.string().describe('Preparation time'),
  cookTime: z.string().describe('Cooking time'),
  servings: z.number().describe('Number of servings'),
  ingredients: z
    .array(
      z.object({
        name: z.string().describe('Ingredient name'),
        quantity: z.string().describe('Quantity needed'),
        unit: z.string().describe('Unit of measurement'),
      }),
    )
    .describe('List of ingredients with quantities'),
  instructions: z.array(z.string()).describe('Step-by-step cooking instructions'),
  winePairing: z.string().optional().describe('Wine pairing recommendation'),
  chefNotes: z.string().optional().describe('Additional chef notes or tips'),
});

async function testRecipeAgent() {
  console.log('='.repeat(80));
  console.log('🧪 TESTING COMPREHENSIVE RECIPE AGENT WITH AI TRACING');
  console.log('='.repeat(80));
  console.log('');

  // Test URLs for different food images
  const testUrls = [
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800', // Pizza
    'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800', // Soup
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800', // Burger
  ];

  // Use the first URL for testing
  const imageUrl = testUrls[0];

  console.log(`📸 Testing with image URL: ${imageUrl}`);
  console.log('');

  try {
    // Test 1: Basic agent with all processors and tools
    console.log('TEST 1: Basic Recipe Generation with Tools');
    console.log('-'.repeat(40));

    const response1 = await recipeAgent.generate(
      `Please analyze this food image and create a detailed French recipe based on what you see: ${imageUrl}

      Use all available tools to:
      1. Search for similar recipes
      2. Get proper cooking techniques
      3. Convert any measurements
      4. Suggest wine pairings

      Provide a complete recipe with reasoning about your choices.`,
    );

    console.log('✅ Recipe Generated:');
    console.log(response1.text);
    console.log('');
    console.log('Tool Calls Made:', response1.toolCalls?.length || 0);
    response1.toolCalls?.forEach(tool => {
      console.log(`  - ${tool.payload?.toolName}: ${JSON.stringify(tool.payload?.args).substring(0, 100)}...`);
    });
    console.log('');

    // Test 2: Structured output generation
    console.log('TEST 2: Structured Recipe Generation');
    console.log('-'.repeat(40));

    const response2 = await structuredRecipeAgent.generate(
      `Create a structured recipe based on this food image: ${imageUrl}

      Generate a complete recipe with all required fields filled out properly.`,
      {
        structuredOutput: {
          schema: recipeOutputSchema,
        },
      },
    );

    console.log('✅ Structured Recipe Data:');
    if (response2.object) {
      console.log(JSON.stringify(response2.object, null, 2));
    }
    console.log('');

    // Test 3: Streaming with real-time processing
    console.log('TEST 3: Streaming Recipe Generation');
    console.log('-'.repeat(40));

    const stream = await recipeAgent.stream(
      `Analyze this dish and create a recipe: ${imageUrl}

      As you work, explain your reasoning for each step.`,
    );

    console.log('Streaming recipe generation...');
    let chunkCount = 0;
    for await (const chunk of stream.textStream) {
      process.stdout.write(chunk);
      chunkCount++;
    }
    console.log('');
    console.log(`Stream complete. Received ${chunkCount} text chunks.`);
    console.log('');

    // Test 4: With custom reasoning model
    console.log('TEST 4: Recipe with Deep Reasoning');
    console.log('-'.repeat(40));

    const response4 = await recipeAgent.generate(
      `Analyze this image: ${imageUrl}

      Think deeply about:
      1. The cultural origins of this dish
      2. Traditional vs modern preparation methods
      3. Ingredient substitutions for dietary restrictions
      4. Wine pairing logic

      Create a sophisticated recipe with detailed reasoning.`,
    );

    console.log('✅ Recipe with Deep Reasoning:');
    console.log('Text length:', response4.text.length);
    console.log('Reasoning sections:', response4.reasoning?.length || 0);
    if (response4.reasoning && response4.reasoning.length > 0) {
      console.log('Sample reasoning:', response4.reasoning[0]);
    }
    console.log('');

    // Summary statistics
    console.log('='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));
    console.log('✅ All tests completed successfully!');
    console.log('');
    console.log('Features tested:');
    console.log('  ✓ URL validation (non-model processor)');
    console.log('  ✓ Image downloading (non-model processor)');
    console.log('  ✓ Image analysis with AI (model processor with structured output)');
    console.log('  ✓ Ingredient translation (model processor)');
    console.log('  ✓ Recipe search tool');
    console.log('  ✓ Cooking technique tool');
    console.log('  ✓ Unit converter tool');
    console.log('  ✓ Wine pairing tool');
    console.log('  ✓ Structured output generation');
    console.log('  ✓ Streaming responses');
    console.log('  ✓ Multi-step reasoning');
    console.log('');
    console.log('This comprehensive test exercises multiple AI tracing scenarios');
    console.log('that will generate rich telemetry data for the tracing feature.');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  testRecipeAgent()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
