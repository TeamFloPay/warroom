import { describe, expect, it } from 'vitest';
import { PassThrough } from 'node:stream';
import { multiSelectChoices } from '../src/lib/prompt.js';

// Without an interactive TTY there is no way to toggle, so the helper must
// return exactly the choices that start checked — preserving "share everything"
// for non-interactive runs and scripts.
describe('multiSelectChoices (non-interactive fallback)', () => {
  const nonTtyInput = new PassThrough();

  it('returns every default-checked value when no checked flag is set', async () => {
    const selected = await multiSelectChoices<string>({
      input: nonTtyInput,
      message: 'pick',
      choices: [
        { label: 'a', value: 'a' },
        { label: 'b', value: 'b' },
        { label: 'c', value: 'c' },
      ],
    });
    expect(selected).toEqual(['a', 'b', 'c']);
  });

  it('omits values explicitly marked checked: false', async () => {
    const selected = await multiSelectChoices<string>({
      input: nonTtyInput,
      message: 'pick',
      choices: [
        { label: 'a', value: 'a', checked: true },
        { label: 'b', value: 'b', checked: false },
        { label: 'c', value: 'c' },
      ],
    });
    expect(selected).toEqual(['a', 'c']);
  });
});
