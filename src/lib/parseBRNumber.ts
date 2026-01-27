/**
 * Parse a Brazilian Real (BRL) formatted number to a JavaScript number.
 * 
 * Handles formats like:
 * - "1.650,00" → 1650.00
 * - "R$ 1.650,00" → 1650.00
 * - "1650,00" → 1650.00
 * - "1650.00" → 1650.00 (also accepts US format)
 * - 1650 → 1650 (already a number)
 * 
 * @param input - String or number input
 * @returns Parsed number, or NaN if invalid
 */
export function parseBRNumber(input: string | number | null | undefined): number {
  // Already a number
  if (typeof input === 'number') {
    return Number.isFinite(input) ? input : NaN;
  }

  // Null/undefined
  if (input == null) {
    return NaN;
  }

  // Not a string
  if (typeof input !== 'string') {
    return NaN;
  }

  // Clean up the string
  let cleaned = input
    .replace(/R\$/g, '')  // Remove currency symbol
    .replace(/\s/g, '')   // Remove whitespace
    .trim();

  // Empty string
  if (cleaned === '') {
    return NaN;
  }

  // Detect format by analyzing separators
  // BRL format: 1.234,56 (dot as thousands, comma as decimal)
  // US format: 1,234.56 (comma as thousands, dot as decimal)
  
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');

  if (lastComma > lastDot) {
    // BRL format: comma is decimal separator
    // Remove all dots (thousands separator), replace comma with dot
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // US format: dot is decimal separator
    // Remove all commas (thousands separator)
    cleaned = cleaned.replace(/,/g, '');
  } else {
    // No decimal separator or only one type
    // Remove commas if present (could be thousands)
    cleaned = cleaned.replace(/,/g, '');
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : NaN;
}

/**
 * Recursively normalize all `value` fields in a config structure to numbers.
 * Handles arrays, nested objects like { Brasil: [...] }, and flat items.
 * 
 * @param config - The config object/array to normalize
 * @returns Normalized config with all `value` fields as numbers
 * @throws Error if any value cannot be parsed
 */
export function normalizeConfigValues<T>(config: T): T {
  if (config === null || config === undefined) {
    return config;
  }

  if (Array.isArray(config)) {
    return config.map(item => normalizeConfigValues(item)) as T;
  }

  if (typeof config === 'object') {
    const result: any = {};

    for (const [key, value] of Object.entries(config)) {
      if (key === 'value') {
        // This is a value field - normalize it
        const parsed = parseBRNumber(value as string | number);
        if (!Number.isFinite(parsed)) {
          // Return the original value, validation will catch it
          result[key] = parsed;
        } else {
          result[key] = parsed;
        }
      } else if (typeof value === 'object' && value !== null) {
        // Recursively process nested objects and arrays
        result[key] = normalizeConfigValues(value);
      } else {
        // Keep other fields as-is
        result[key] = value;
      }
    }

    return result as T;
  }

  // Primitive values
  return config;
}

/**
 * Validate that all `value` fields in a config structure are valid numbers.
 * 
 * @param config - The config object/array to validate
 * @param path - Current path for error reporting
 * @returns Object with isValid and errors array
 */
export function validateConfigValues(
  config: unknown,
  path: string = ''
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  function traverse(obj: unknown, currentPath: string) {
    if (obj === null || obj === undefined) {
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        traverse(item, `${currentPath}[${index}]`);
      });
      return;
    }

    if (typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        const newPath = currentPath ? `${currentPath}.${key}` : key;
        
        if (key === 'value') {
          if (typeof value !== 'number' || !Number.isFinite(value)) {
            const label = (obj as any).label || 'desconhecido';
            errors.push(`Valor inválido em "${label}" (${newPath})`);
          }
        } else if (typeof value === 'object' && value !== null) {
          traverse(value, newPath);
        }
      }
    }
  }

  traverse(config, path);

  return {
    isValid: errors.length === 0,
    errors,
  };
}
