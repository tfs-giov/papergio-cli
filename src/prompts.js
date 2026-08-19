import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { prompt } = require('enquirer');

export const option = (name, message, value) => ({ name, message, value });

export async function selectPrompt(message, options, { multi = false, defaultValue } = {}) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return multi ? [defaultValue ?? options[0].value] : (defaultValue ?? options[0].value);
  }
  const response = await prompt({
    type: multi ? 'multiselect' : 'select',
    name: 'value',
    message,
    choices: options.map((item) => ({ name: item.value, message: `${item.name} — ${item.message}` })),
    initial: defaultValue ? options.findIndex((item) => item.value === defaultValue) : 0
  });
  return response.value;
}

export async function confirmPrompt(message) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return true;
  const response = await prompt({ type: 'confirm', name: 'confirmed', message, initial: true });
  return response.confirmed;
}
