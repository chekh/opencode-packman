export type DoctorSeverity = 'ok' | 'info' | 'warning' | 'error';

export type DoctorIssue = {
  severity: Exclude<DoctorSeverity, 'ok'>;
  code: string;
  message: string;
  path?: string;
  hint?: string;
};

export type DoctorCheck = {
  code: string;
  label: string;
  status: DoctorSeverity;
  message?: string;
};

export type DoctorReport = {
  status: 'healthy' | 'warning' | 'broken';
  projectRoot: string;
  checks: DoctorCheck[];
  issues: DoctorIssue[];
};

const severityRank: Record<DoctorSeverity, number> = {
  ok: 0,
  info: 1,
  warning: 2,
  error: 3,
};

export function createCheck(code: string, label: string): DoctorCheck {
  return {
    code,
    label,
    status: 'ok',
  };
}

export function escalateCheck(
  check: DoctorCheck,
  severity: Exclude<DoctorSeverity, 'ok'>,
  message: string,
): DoctorCheck {
  if (severityRank[severity] > severityRank[check.status]) {
    return {
      ...check,
      status: severity,
      message,
    };
  }

  return check;
}

export function resolveDoctorStatus(
  issues: DoctorIssue[],
): DoctorReport['status'] {
  if (issues.some((issue) => issue.severity === 'error')) {
    return 'broken';
  }

  if (issues.some((issue) => issue.severity === 'warning')) {
    return 'warning';
  }

  return 'healthy';
}
