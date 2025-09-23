/**
 * Valida que un string no contenga tokens de plantilla EJS.
 * @param input String a validar
 * @returns true si el string es seguro, false si contiene tokens de plantilla
 */
export function validateNoTemplateTokens(input: string): boolean {
  const templateTokenPattern = /<%.*%>/;
  return !templateTokenPattern.test(input);
}

/**
 * Sanea un string eliminando cualquier token de plantilla EJS.
 * @param input String a sanear
 * @returns String saneado sin tokens de plantilla
 */
export function sanitizeTemplateInput(input: string): string {
  return input.replace(/[<%>]/g, '');
}