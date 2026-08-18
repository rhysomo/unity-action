import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Unity project version을 한 번의 작업 동안 적용하고 원본 파일을 복원한다. */
export async function withProjectVersion<T>(projectPath: string, version: string, run: () => Promise<T>): Promise<T> {
  if (!version) return run();

  const path = join(projectPath, 'ProjectSettings', 'ProjectSettings.asset');
  const original = await readFile(path, 'utf8');
  const stamped = stampBundleVersion(original, version);
  await writeFile(path, stamped);

  try {
    return await run();
  } finally {
    await writeFile(path, original);
  }
}

/** Unity PlayerSettings의 bundleVersion 필드를 안전한 YAML string으로 교체한다. */
export function stampBundleVersion(settings: string, version: string): string {
  const matches = settings.match(/^  bundleVersion:/gm) ?? [];
  if (matches.length !== 1) {
    throw new Error(`Expected one bundleVersion in ProjectSettings.asset, found ${matches.length}.`);
  }

  return settings.replace(/^  bundleVersion:[^\r\n]*(?=\r?$)/m, `  bundleVersion: ${JSON.stringify(version)}`);
}
