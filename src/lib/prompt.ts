import { createInterface } from 'node:readline';
import { checkbox, select } from '@inquirer/prompts';

type Output = (text: string) => void;
type Input = NodeJS.ReadableStream & { isTTY?: boolean };

export type SelectChoice<T> = {
  label: string;
  value: T;
  aliases?: string[];
};

export type SelectChoiceOptions<T> = {
  output: Output;
  input: Input;
  question: string;
  choices: SelectChoice<T>[];
  default: T;
  retryHelp: string;
};

function isInteractiveTTY(input: Input): boolean {
  return Boolean(input.isTTY) && Boolean(process.stdout.isTTY);
}

export async function selectChoice<T>(opts: SelectChoiceOptions<T>): Promise<T> {
  if (isInteractiveTTY(opts.input)) {
    const message = opts.question.replace(/\s*\[[^\]]+\]\s*$/, '').trim();
    try {
      return await select<T>({
        message,
        default: opts.default,
        choices: opts.choices.map((choice) => ({ name: choice.label, value: choice.value })),
      });
    } catch (error) {
      const name = (error as { name?: string } | null)?.name;
      if (name === 'ExitPromptError') return opts.default;
      throw error;
    }
  }

  opts.output(opts.question);
  const readline = createInterface({ input: opts.input, crlfDelay: Infinity });
  try {
    for await (const line of readline) {
      const answer = line.trim().toLowerCase();
      if (!answer) return opts.default;
      const match = opts.choices.find((choice) => {
        const aliases = [choice.label.toLowerCase(), ...(choice.aliases ?? []).map((a) => a.toLowerCase())];
        return aliases.includes(answer);
      });
      if (match) return match.value;
      opts.output(opts.retryHelp);
    }
  } finally {
    readline.close();
  }

  return opts.default;
}

export type MultiSelectChoice<T> = {
  label: string;
  value: T;
  // Whether the row starts toggled on. Defaults to true so an un-curated
  // run keeps every option (matching the prior "include everything" behaviour).
  checked?: boolean;
};

export type MultiSelectOptions<T> = {
  input: Input;
  message: string;
  choices: MultiSelectChoice<T>[];
};

// Renders a toggleable multi-select (checkbox) list and returns the selected
// values. Returns null when the user aborts (Ctrl-C) so the caller can cancel.
// Without an interactive TTY there is no way to toggle, so every default-checked
// choice is returned unchanged.
export async function multiSelectChoices<T>(opts: MultiSelectOptions<T>): Promise<T[] | null> {
  if (!isInteractiveTTY(opts.input)) {
    return opts.choices.filter((choice) => choice.checked !== false).map((choice) => choice.value);
  }
  try {
    return await checkbox<T>({
      message: opts.message,
      choices: opts.choices.map((choice) => ({ name: choice.label, value: choice.value, checked: choice.checked !== false })),
      pageSize: 15,
      loop: false,
    });
  } catch (error) {
    const name = (error as { name?: string } | null)?.name;
    if (name === 'ExitPromptError') return null;
    throw error;
  }
}
