import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Unit Converter Tool
 * Converts cooking measurements between different units
 */
export const unitConverterTool = createTool({
  id: 'unit-converter',
  description: 'Convert cooking measurements between different units (metric, imperial, etc.)',
  inputSchema: z.object({
    value: z.number().describe('The numeric value to convert'),
    fromUnit: z.string().describe('The unit to convert from (e.g., cup, ml, oz, g)'),
    toUnit: z.string().describe('The unit to convert to'),
    ingredientType: z
      .enum(['liquid', 'dry', 'weight', 'temperature'])
      .optional()
      .describe('Type of ingredient for more accurate conversion'),
  }),
  execute: async ({ context }) => {
    const { value, fromUnit, toUnit, ingredientType } = context;

    console.log(`[Unit Converter Tool] Converting ${value} ${fromUnit} to ${toUnit}`);

    // Conversion factors (simplified for demo)
    const conversions: Record<string, Record<string, number>> = {
      // Volume conversions
      cup: { ml: 237, l: 0.237, oz: 8, tbsp: 16, tsp: 48, cup: 1 },
      ml: { cup: 0.00422, l: 0.001, oz: 0.03381, ml: 1, cl: 0.1 },
      l: { ml: 1000, cup: 4.227, oz: 33.814, l: 1 },
      oz: { ml: 29.574, cup: 0.125, oz: 1, tbsp: 2 },
      tbsp: { ml: 14.787, tsp: 3, oz: 0.5, tbsp: 1, cup: 0.0625 },
      tsp: { ml: 4.929, tbsp: 0.333, tsp: 1, cup: 0.0208 },

      // Weight conversions
      g: { kg: 0.001, oz: 0.03527, lb: 0.0022, g: 1, mg: 1000 },
      kg: { g: 1000, lb: 2.205, oz: 35.274, kg: 1 },
      oz_weight: { g: 28.35, lb: 0.0625, kg: 0.02835, oz_weight: 1 },
      lb: { kg: 0.4536, g: 453.6, oz_weight: 16, lb: 1 },

      // Temperature conversions (special handling needed)
      celsius: { fahrenheit: 'special', kelvin: 'special', celsius: 1 },
      fahrenheit: { celsius: 'special', kelvin: 'special', fahrenheit: 1 },
    };

    // Normalize unit names
    const normalizeUnit = (unit: string): string => {
      const normalized = unit.toLowerCase().trim();
      // Handle common variations
      if (normalized === 'ounce' || normalized === 'ounces') return 'oz';
      if (normalized === 'gram' || normalized === 'grams') return 'g';
      if (normalized === 'kilogram' || normalized === 'kilograms') return 'kg';
      if (normalized === 'pound' || normalized === 'pounds') return 'lb';
      if (normalized === 'milliliter' || normalized === 'milliliters') return 'ml';
      if (normalized === 'liter' || normalized === 'liters') return 'l';
      if (normalized === 'tablespoon' || normalized === 'tablespoons') return 'tbsp';
      if (normalized === 'teaspoon' || normalized === 'teaspoons') return 'tsp';
      if (normalized === 'cups') return 'cup';
      if (normalized === 'c' || normalized === 'f') return normalized === 'c' ? 'celsius' : 'fahrenheit';
      return normalized;
    };

    const from = normalizeUnit(fromUnit);
    const to = normalizeUnit(toUnit);

    let result: number;
    let formula = '';

    // Handle temperature conversions specially
    if (from === 'celsius' && to === 'fahrenheit') {
      result = (value * 9) / 5 + 32;
      formula = '(°C × 9/5) + 32 = °F';
    } else if (from === 'fahrenheit' && to === 'celsius') {
      result = ((value - 32) * 5) / 9;
      formula = '(°F - 32) × 5/9 = °C';
    } else if (conversions[from] && conversions[from][to]) {
      // Standard conversion
      const factor = conversions[from][to];
      if (typeof factor === 'number') {
        result = value * factor;
        formula = `${fromUnit} × ${factor} = ${toUnit}`;
      } else {
        throw new Error(`Special conversion not implemented for ${from} to ${to}`);
      }
    } else {
      // Try to find indirect conversion through intermediate unit
      if (conversions[from]?.ml && conversions.ml[to]) {
        const toMl = value * conversions[from].ml;
        result = toMl * conversions.ml[to];
        formula = `${fromUnit} → ml → ${toUnit}`;
      } else if (conversions[from]?.g && conversions.g[to]) {
        const toG = value * conversions[from].g;
        result = toG * conversions.g[to];
        formula = `${fromUnit} → g → ${toUnit}`;
      } else {
        throw new Error(`Cannot convert from ${fromUnit} to ${toUnit}`);
      }
    }

    // Round to reasonable precision
    const rounded = Math.round(result * 100) / 100;

    console.log(`[Unit Converter Tool] Converted: ${value} ${fromUnit} = ${rounded} ${toUnit}`);

    return {
      original: {
        value,
        unit: fromUnit,
      },
      converted: {
        value: rounded,
        unit: toUnit,
      },
      formula,
      ingredientType: ingredientType || 'general',
      note:
        ingredientType === 'dry'
          ? 'Note: Dry ingredient conversions may vary by density'
          : 'Conversion completed successfully',
    };
  },
});
