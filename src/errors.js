export class FoundryError extends Error {
  constructor(message, { code = 'FOUNDRY_ERROR', hint, cause } = {}) {
    super(message, { cause });
    this.name = 'FoundryError';
    this.code = code;
    this.hint = hint;
  }
}

export function formatError(error) {
  const message = error instanceof Error ? error.message : String(error);
  const code = error?.code && error.code !== 'FOUNDRY_ERROR' ? ` [${error.code}]` : '';
  const hint = error?.hint ? `\nHint: ${error.hint}` : '';
  return `Foundry error${code}: ${message}${hint}`;
}
