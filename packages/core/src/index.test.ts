import { describe, expect, it } from 'vitest';

import {
  addLocalRegistry,
  applyInstallPlan,
  applyRemovePlan,
  buildInstallPlan,
  buildRemovePlan,
  createPackageScaffold,
  initProject,
  listRegistries,
  listAllRegistryPackages,
  listRegistryPackages,
  loadPackage,
  removeRegistry,
  resolvePackageReference,
  renderRemovePlan,
  renderDoctorReport,
  renderInstallPlan,
  runDoctor,
  searchRegistryPackages,
  validatePackage,
} from './index.js';

describe('core exports', () => {
  it('exports preview chain functions', () => {
    expect(typeof loadPackage).toBe('function');
    expect(typeof validatePackage).toBe('function');
    expect(typeof buildInstallPlan).toBe('function');
    expect(typeof renderInstallPlan).toBe('function');
    expect(typeof applyInstallPlan).toBe('function');
    expect(typeof initProject).toBe('function');
    expect(typeof buildRemovePlan).toBe('function');
    expect(typeof applyRemovePlan).toBe('function');
    expect(typeof renderRemovePlan).toBe('function');
    expect(typeof runDoctor).toBe('function');
    expect(typeof renderDoctorReport).toBe('function');
    expect(typeof addLocalRegistry).toBe('function');
    expect(typeof removeRegistry).toBe('function');
    expect(typeof listRegistries).toBe('function');
    expect(typeof resolvePackageReference).toBe('function');
    expect(typeof listRegistryPackages).toBe('function');
    expect(typeof listAllRegistryPackages).toBe('function');
    expect(typeof searchRegistryPackages).toBe('function');
    expect(typeof createPackageScaffold).toBe('function');
  });
});
