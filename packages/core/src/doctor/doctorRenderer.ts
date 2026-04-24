import type { DoctorCheck, DoctorReport, DoctorSeverity } from './checks.js';

function severityLabel(severity: DoctorSeverity): string {
  if (severity === 'ok') {
    return 'OK';
  }

  if (severity === 'info') {
    return 'INFO';
  }

  if (severity === 'warning') {
    return 'WARNING';
  }

  return 'ERROR';
}

function renderCheck(check: DoctorCheck): string {
  const status = severityLabel(check.status).padEnd(8, ' ');
  const detail = check.message ?? check.label;
  return `  ${status} ${detail}`;
}

export function renderDoctorReport(report: DoctorReport): string {
  const lines: string[] = [];
  lines.push('Doctor report');
  lines.push('');
  lines.push(`Status: ${report.status}`);
  lines.push('');
  lines.push('Checks:');
  for (const check of report.checks) {
    lines.push(renderCheck(check));
  }

  lines.push('');
  lines.push('Issues:');

  if (report.issues.length === 0) {
    lines.push('  none');
    return lines.join('\n');
  }

  for (const issue of report.issues) {
    lines.push(`  ${severityLabel(issue.severity)} ${issue.code}`);
    if (issue.path !== undefined) {
      lines.push(`    Path: ${issue.path}`);
    }
    lines.push(`    ${issue.message}`);
    if (issue.hint !== undefined) {
      lines.push(`    Hint: ${issue.hint}`);
    }
  }

  return lines.join('\n');
}
