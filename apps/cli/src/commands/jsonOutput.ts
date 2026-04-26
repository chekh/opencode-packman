export type CommandJsonIssue = {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  path?: string;
  hint?: string;
};

export type CommandJsonResult<T> = {
  ok: boolean;
  command: string;
  data?: T;
  issues?: CommandJsonIssue[];
};

export function printJson<T>(result: CommandJsonResult<T>): void {
  const output = JSON.stringify(result, null, 2);
  process.stdout.write(`${output}\n`);
}

export function formatValidationIssues(
  errors: Array<{ code: string; message: string; path?: string }>,
  warnings: Array<{ code: string; message: string; path?: string }>,
): CommandJsonIssue[] {
  const issues: CommandJsonIssue[] = [];

  for (const err of errors) {
    issues.push({
      severity: 'error',
      code: err.code,
      message: err.message,
      ...(err.path === undefined ? {} : { path: err.path }),
    });
  }

  for (const warn of warnings) {
    issues.push({
      severity: 'warning',
      code: warn.code,
      message: warn.message,
      ...(warn.path === undefined ? {} : { path: warn.path }),
    });
  }

  return issues;
}

export function formatDoctorIssues(
  issues: Array<{
    severity: 'info' | 'warning' | 'error';
    code: string;
    message: string;
    path?: string;
    hint?: string;
  }>,
): CommandJsonIssue[] {
  return issues.map((issue) => ({
    severity: issue.severity,
    code: issue.code,
    message: issue.message,
    ...(issue.path === undefined ? {} : { path: issue.path }),
    ...(issue.hint === undefined ? {} : { hint: issue.hint }),
  }));
}
