export { loadPackage, type LoadedPackage } from './package/packageLoader.js';
export { validatePackage, type ValidationResult, type ValidationMessage } from './package/packageValidator.js';
export { getProjectPaths, type ProjectPaths } from './project/projectPaths.js';
export { initProject, type InitProjectResult } from './project/initProject.js';
export {
  createProjectBaseline,
  readProjectBaseline,
  writeProjectBaseline,
  computeFileChecksum,
  type ProjectBaseline,
  SUPPORTED_BASELINE_SCHEMA
} from './project/baseline.js';
export { getProjectStatus, type ProjectStatusResult } from './project/projectStatus.js';
export { getConfigPathsSummary, type ConfigPathsSummary } from './config/pathsSummary.js';
export {
  createPackageScaffold,
  resolveCreatePackageTarget,
  type CreatePackageType,
  type CreatePackageInput,
  type CreatePackageResult
} from './create/packageScaffold.js';
export { buildInstallPlan, type BuildInstallPlanInput } from './plan/planBuilder.js';
export {
  type InstallPlan,
  type InstallAction,
  type CopyFileAction,
  type CopyDirectoryAction,
  type PatchJsonAction,
  type PlanConflict,
  type PlanScope,
  type CopyStrategy
} from './plan/installPlan.js';
export { renderInstallPlan } from './diff/diffRenderer.js';
export { applyInstallPlan, type InstallResult, type AppliedAction } from './install/installer.js';
export { deepMergeJsonObjects } from './install/jsonPatch.js';
export { readLockfile, writeLockfile, updateLockfileFromInstall } from './lock/lockfile.js';
export { runDoctor } from './doctor/doctor.js';
export { renderDoctorReport } from './doctor/doctorRenderer.js';
export type { DoctorReport, DoctorIssue, DoctorCheck } from './doctor/checks.js';
export { buildRemovePlan, applyRemovePlan, type RemovePlan, type RemoveResult, type RemoveAction } from './remove/remover.js';
export { renderRemovePlan, renderRemoveResult } from './remove/removeRenderer.js';
export {
  getDefaultRegistryConfigPath,
  getDefaultRegistryConfigDir,
  readRegistryConfig,
  writeRegistryConfig,
  addLocalRegistry,
  removeRegistry,
  listRegistries
} from './registry/registryConfig.js';
export { resolvePackageReference } from './registry/registryResolver.js';
export {
  listRegistryPackages,
  listAllRegistryPackages,
  searchRegistryPackages,
  type RegistryPackageSummary
} from './registry/registryPackages.js';
export {
  registryConfigSchema,
  registryEntrySchema,
  SUPPORTED_REGISTRY_SCHEMA,
  type RegistryConfig,
  type RegistryEntry
} from './registry/registrySchema.js';
export {
  packageManifestSchema,
  type PackageManifest,
  type PackageType,
  type ExportStrategy,
  type PackageMetadata,
  type PackageCompatibility,
  type PackageEnv,
  type PackageRisk,
  SUPPORTED_PACKAGE_SCHEMA
} from './package/packageSchema.js';
export {
  lockfileSchema,
  type Lockfile,
  type LockPackageEntry,
  type LockFileOwnerEntry,
  type LockPatchEntry,
  SUPPORTED_LOCK_SCHEMA
} from './lock/lockSchema.js';
export {
  publishPackage,
  type PublishPackageInput,
  type PublishPackageResult
} from './package/packagePublisher.js';
