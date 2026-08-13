import { describe, expect, it } from 'vitest';
import { cliPlatform, parseManifest } from '../src/cli.js';

describe('parseManifest', () => {
  it('selects the current platform binary', () => {
    const manifest = parseManifest(
      {
        version: '1.0.0-beta.4',
        binaries: {
          'linux-x64': {
            filename: 'unity-linux-x64',
            sha256: 'a'.repeat(64),
          },
        },
      },
      'linux-x64',
    );

    expect(manifest).toEqual({
      version: '1.0.0-beta.4',
      binary: { filename: 'unity-linux-x64', sha256: 'a'.repeat(64) },
    });
  });

  it('rejects unsafe binary paths and checksums', () => {
    expect(() =>
      parseManifest(
        {
          version: '1.0.0-beta.4',
          binaries: { 'linux-x64': { filename: '../unity', sha256: 'invalid' } },
        },
        'linux-x64',
      ),
    ).toThrow('invalid binary entry');
  });
});

describe('cliPlatform', () => {
  it.each([
    ['darwin', 'arm64', 'darwin-arm64'],
    ['linux', 'x64', 'linux-x64'],
    ['win32', 'x64', 'win32-x64'],
  ] as const)('maps %s %s', (platform, architecture, expected) => {
    expect(cliPlatform(platform, architecture)).toBe(expected);
  });

  it('rejects unsupported runners', () => {
    expect(() => cliPlatform('freebsd', 'x64')).toThrow('not available for freebsd-x64');
  });
});
