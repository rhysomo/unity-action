import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { stampBundleVersion, withProjectVersion } from '../src/version.js';

describe('stampBundleVersion', () => {
  it('writes the version as a quoted YAML string', () => {
    const settings = 'PlayerSettings:\n  bundleVersion: 1.0\n  AndroidBundleVersionCode: 1\n';

    expect(stampBundleVersion(settings, '1.2.3-rc.1')).toContain('  bundleVersion: "1.2.3-rc.1"');
  });

  it('requires exactly one bundleVersion field', () => {
    expect(() => stampBundleVersion('PlayerSettings:\n', '1.2.3')).toThrow(
      'Expected one bundleVersion in ProjectSettings.asset, found 0',
    );
  });
});

describe('withProjectVersion', () => {
  it('restores ProjectSettings after a successful build', async () => {
    const fixture = await projectFixture();

    await withProjectVersion(fixture.projectPath, '1.2.3', async () => {
      expect(await readFile(fixture.settingsPath, 'utf8')).toContain('  bundleVersion: "1.2.3"');
    });

    expect(await readFile(fixture.settingsPath, 'utf8')).toBe(fixture.original);
  });

  it('restores ProjectSettings after a failed build', async () => {
    const fixture = await projectFixture();

    await expect(
      withProjectVersion(fixture.projectPath, '1.2.3', async () => {
        throw new Error('build failed');
      }),
    ).rejects.toThrow('build failed');

    expect(await readFile(fixture.settingsPath, 'utf8')).toBe(fixture.original);
  });
});

async function projectFixture() {
  const projectPath = await mkdtemp(join(tmpdir(), 'unity-action-version-'));
  const settingsPath = join(projectPath, 'ProjectSettings', 'ProjectSettings.asset');
  const original = 'PlayerSettings:\n  bundleVersion: 1.0\n';
  await mkdir(join(projectPath, 'ProjectSettings'));
  await writeFile(settingsPath, original);
  return { projectPath, settingsPath, original };
}
