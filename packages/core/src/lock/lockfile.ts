export async function readLockfile() {
  return { schema: 'opencode-packman/lock/v1' };
}

export async function writeLockfile() {
  return;
}
