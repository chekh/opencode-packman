import { describe, expect, it } from 'vitest';

import {
  formatValidationIssues,
  formatDoctorIssues,
  type CommandJsonResult,
  type CommandJsonIssue,
} from './jsonOutput.js';

describe('jsonOutput', () => {
  describe('formatValidationIssues', () => {
    it('formats errors with error severity', () => {
      const errors = [
        {
          code: 'missing_file',
          message: 'File not found',
          path: '/path/to/file',
        },
      ];
      const warnings: Array<{ code: string; message: string; path?: string }> =
        [];

      const issues = formatValidationIssues(errors, warnings);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toEqual({
        severity: 'error',
        code: 'missing_file',
        message: 'File not found',
        path: '/path/to/file',
      });
    });

    it('formats warnings with warning severity', () => {
      const errors: Array<{ code: string; message: string; path?: string }> =
        [];
      const warnings = [
        { code: 'deprecated_field', message: 'Field is deprecated' },
      ];

      const issues = formatValidationIssues(errors, warnings);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toEqual({
        severity: 'warning',
        code: 'deprecated_field',
        message: 'Field is deprecated',
      });
    });

    it('includes path when present', () => {
      const errors = [
        { code: 'invalid_yaml', message: 'Invalid YAML', path: 'package.yaml' },
      ];
      const warnings: Array<{ code: string; message: string; path?: string }> =
        [];

      const issues = formatValidationIssues(errors, warnings);

      expect(issues[0]?.path).toBe('package.yaml');
    });

    it('omits path when undefined', () => {
      const errors = [{ code: 'invalid_yaml', message: 'Invalid YAML' }];
      const warnings: Array<{ code: string; message: string; path?: string }> =
        [];

      const issues = formatValidationIssues(errors, warnings);

      expect(issues[0]?.path).toBeUndefined();
    });

    it('combines errors and warnings', () => {
      const errors = [{ code: 'error1', message: 'Error 1' }];
      const warnings = [
        { code: 'warning1', message: 'Warning 1' },
        { code: 'warning2', message: 'Warning 2' },
      ];

      const issues = formatValidationIssues(errors, warnings);

      expect(issues).toHaveLength(3);
      expect(issues[0]?.severity).toBe('error');
      expect(issues[1]?.severity).toBe('warning');
      expect(issues[2]?.severity).toBe('warning');
    });
  });

  describe('formatDoctorIssues', () => {
    it('formats doctor issues preserving severity', () => {
      const issues = [
        {
          severity: 'error' as const,
          code: 'missing_file',
          message: 'File missing',
        },
        {
          severity: 'warning' as const,
          code: 'modified_file',
          message: 'File modified',
        },
        {
          severity: 'info' as const,
          code: 'info_msg',
          message: 'Info message',
        },
      ];

      const formatted = formatDoctorIssues(issues);

      expect(formatted).toHaveLength(3);
      expect(formatted[0]?.severity).toBe('error');
      expect(formatted[1]?.severity).toBe('warning');
      expect(formatted[2]?.severity).toBe('info');
    });

    it('includes path and hint when present', () => {
      const issues = [
        {
          severity: 'error' as const,
          code: 'missing_skill',
          message: 'SKILL.md not found',
          path: 'skills/review/',
          hint: 'Create SKILL.md with frontmatter',
        },
      ];

      const formatted = formatDoctorIssues(issues);

      expect(formatted[0]).toEqual({
        severity: 'error',
        code: 'missing_skill',
        message: 'SKILL.md not found',
        path: 'skills/review/',
        hint: 'Create SKILL.md with frontmatter',
      });
    });

    it('omits path and hint when undefined', () => {
      const issues = [
        {
          severity: 'warning' as const,
          code: 'no_tags',
          message: 'No tags defined',
        },
      ];

      const formatted = formatDoctorIssues(issues);

      expect(formatted[0]?.path).toBeUndefined();
      expect(formatted[0]?.hint).toBeUndefined();
    });
  });

  describe('CommandJsonResult type', () => {
    it('creates valid success result', () => {
      const result: CommandJsonResult<{ name: string }> = {
        ok: true,
        command: 'test',
        data: { name: 'test-package' },
      };

      expect(result.ok).toBe(true);
      expect(result.command).toBe('test');
      expect(result.data).toEqual({ name: 'test-package' });
    });

    it('creates valid failure result', () => {
      const issues: CommandJsonIssue[] = [
        { severity: 'error', code: 'not_found', message: 'Package not found' },
      ];

      const result: CommandJsonResult<never> = {
        ok: false,
        command: 'test',
        issues,
      };

      expect(result.ok).toBe(false);
      expect(result.issues).toHaveLength(1);
    });
  });
});
