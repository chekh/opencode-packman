export function indentLines(lines: string[], indent = '  '): string[] {
  return lines.map((line) => `${indent}${line}`);
}

export function renderNone(indent = '  '): string {
  return `${indent}none`;
}

export function renderSection(title: string, lines: string[], indent = '  '): string[] {
  if (lines.length === 0) {
    return [title, renderNone(indent)];
  }

  return [title, ...indentLines(lines, indent)];
}

export function formatCount(label: string, value: number): string {
  return `${label}: ${value}`;
}
