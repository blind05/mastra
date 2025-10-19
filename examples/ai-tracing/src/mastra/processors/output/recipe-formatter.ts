/**
 * Recipe Formatter Output Processor
 * Non-model based processor that formats recipes into different formats
 */

export const recipeFormatterProcessor = {
  name: 'recipe-formatter',
  process: async (text: string) => {
    console.log('[Recipe Formatter] Formatting recipe output');

    // Parse the recipe text and format it nicely
    const lines = text.split('\n');
    const formatted: string[] = [];

    let inIngredientsSection = false;
    let inInstructionsSection = false;

    formatted.push('='.repeat(60));
    formatted.push('🍽️  RECIPE CARD');
    formatted.push('='.repeat(60));
    formatted.push('');

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Detect sections
      if (trimmedLine.toLowerCase().includes('ingredient')) {
        inIngredientsSection = true;
        inInstructionsSection = false;
        formatted.push('📝 INGREDIENTS:');
        formatted.push('-'.repeat(40));
        continue;
      }

      if (
        trimmedLine.toLowerCase().includes('instruction') ||
        trimmedLine.toLowerCase().includes('method') ||
        trimmedLine.toLowerCase().includes('step')
      ) {
        inIngredientsSection = false;
        inInstructionsSection = true;
        formatted.push('');
        formatted.push('👨‍🍳 INSTRUCTIONS:');
        formatted.push('-'.repeat(40));
        continue;
      }

      // Format based on section
      if (inIngredientsSection && trimmedLine) {
        // Add bullet points to ingredients
        if (!trimmedLine.startsWith('•') && !trimmedLine.startsWith('-')) {
          formatted.push(`  • ${trimmedLine}`);
        } else {
          formatted.push(`  ${trimmedLine}`);
        }
      } else if (inInstructionsSection && trimmedLine) {
        // Number the instructions if not already numbered
        if (/^\d+[\.)]\s/.test(trimmedLine)) {
          formatted.push(`  ${trimmedLine}`);
        } else if (trimmedLine) {
          const stepNumber = formatted.filter(l => l.match(/^\s+\d+\./)).length + 1;
          formatted.push(`  ${stepNumber}. ${trimmedLine}`);
        }
      } else if (trimmedLine) {
        // Other content
        formatted.push(trimmedLine);
      }
    }

    // Add metadata footer
    formatted.push('');
    formatted.push('='.repeat(60));
    formatted.push('📊 RECIPE METADATA:');
    formatted.push(`Generated: ${new Date().toISOString()}`);
    formatted.push(`Format: Structured Recipe Card`);
    formatted.push('='.repeat(60));

    const result = formatted.join('\n');
    console.log('[Recipe Formatter] Formatting complete');

    return result;
  },
};
