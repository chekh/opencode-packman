import type { ValidationResult } from '../package/packageValidator.js';

export type PlanScope = 'project';
export type CopyStrategy = 'add' | 'replace';

export type CopyFileAction = {
  type: 'copyFile';
  from: string;
  to: string;
  strategy: CopyStrategy;
  objectType: 'agent' | 'command';
  objectName: string;
  modelAlias?: string;
};

export type CopyDirectoryAction = {
  type: 'copyDirectory';
  from: string;
  to: string;
  strategy: CopyStrategy;
  objectType: 'skill';
  objectName: string;
  modelAlias?: string;
};

export type PatchJsonAction = {
  type: 'patchJson';
  from: string;
  to: string;
  strategy: 'patch';
  objectType: 'config';
  permissionsPreview?: Record<string, unknown>;
};

export type InstallAction = CopyFileAction | CopyDirectoryAction | PatchJsonAction;

export type PlanConflict = {
  code: string;
  message: string;
  path?: string;
};

export type InstallPlan = {
  packageName: string;
  packageVersion: string;
  packageRoot: string;
  projectRoot: string;
  scope: PlanScope;
  actions: InstallAction[];
  conflicts: PlanConflict[];
  warnings: Array<{ code: string; message: string; path?: string }>;
  validation: ValidationResult;
};
