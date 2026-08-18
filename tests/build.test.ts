import { describe, expect, it } from 'vitest';
import { buildArguments, normalizeTagVersion, resolveBuild } from '../src/build.js';
import type { Inputs } from '../src/inputs.js';

describe('resolveBuild', () => {
  it('lets args override promoted inputs while preserving unknown Unity CLI arguments', () => {
    const request = resolveBuild(
      input({
        target: 'StandaloneWindows64',
        outputPath: 'build/default.exe',
        args: '--target WebGL --output-path="build/web game" --allow-install --android-symbol-type public --custom-flag="quoted value"',
      }),
    );

    expect(request.target).toBe('WebGL');
    expect(request.outputPath).toBe('build/web game');
    expect(request.allowInstall).toBe(true);
    expect(request.extraArgs).toEqual(['--android-symbol-type', 'public', '--custom-flag=quoted value']);
  });

  it('refuses arguments that would break the action log contract', () => {
    expect(() => resolveBuild(input({ args: '--no-tail' }))).toThrow('--no-tail is managed by unity-action');
    expect(() => resolveBuild(input({ args: '--log-file other.log' }))).toThrow(
      '--log-file is managed by unity-action',
    );
  });
});

describe('buildArguments', () => {
  it('streams logs by default', () => {
    const command = buildArguments(resolveBuild(input()), '/tmp/build.log');

    expect(command.args).not.toContain('--quiet');
  });

  it('disables log streaming in quiet mode', () => {
    const command = buildArguments(resolveBuild(input({ quiet: true })), '/tmp/build.log');

    expect(command.args).toContain('--quiet');
  });

  it('resolves tag versioning without passing unsupported native build options', () => {
    const request = resolveBuild(input({ target: 'StandaloneOSX', outputPath: '/tmp/REVIVE.app' }));
    request.versioningStrategy = 'tag';

    const command = buildArguments(request, '/tmp/build.log', 'v1.2.3-rc.1');

    expect(command.buildVersion).toBe('1.2.3-rc.1');
    expect(command.args).not.toContain('--versioning-strategy');
    expect(command.args).not.toContain('--build-version');
    expect(command.args.join(' ')).toContain('--log-file /tmp/build.log');
  });

  it('delegates versioning when an execute method owns the build', () => {
    const request = resolveBuild(
      input({
        versioningStrategy: 'tag',
        args: '--execute-method REVIVE.Build.BuildScript.Build',
      }),
    );

    const command = buildArguments(request, '/tmp/build.log', 'v1.2.3');

    expect(command.args.join(' ')).toContain('--execute-method REVIVE.Build.BuildScript.Build');
    expect(command.args.join(' ')).toContain('--versioning-strategy custom --build-version 1.2.3');
  });

  it('rejects semantic versioning for native builds', () => {
    const request = resolveBuild(input({ versioningStrategy: 'semantic' }));

    expect(() => buildArguments(request, '/tmp/build.log')).toThrow(
      'versioning-strategy semantic requires --execute-method',
    );
  });

  it('rejects native version stamping when a Build Profile can override PlayerSettings', () => {
    const request = resolveBuild(
      input({ profile: 'Windows Release', versioningStrategy: 'custom', buildVersion: '1.2.3' }),
    );

    expect(() => buildArguments(request, '/tmp/build.log')).toThrow(
      'Native build versioning with a Build Profile requires --execute-method',
    );
  });

  it('accepts a Build Profile without a target', () => {
    const request = resolveBuild(input({ target: '', profile: 'Windows Release' }));

    expect(buildArguments(request, '/tmp/build.log').args.join(' ')).toContain('--profile Windows Release');
  });

  it('requires the custom build version', () => {
    const request = resolveBuild(input({ versioningStrategy: 'custom' }));

    expect(() => buildArguments(request, '/tmp/build.log')).toThrow(
      'build-version is required for versioning-strategy custom',
    );
  });
});

describe('normalizeTagVersion', () => {
  it.each([
    ['v1.2.3', '1.2.3'],
    ['1.2.3', '1.2.3'],
    ['v1.2.3-rc.1+build.7', '1.2.3-rc.1+build.7'],
    ['v1.2.3.4', '1.2.3.4'],
  ])('normalizes %s', (tag, expected) => {
    expect(normalizeTagVersion(tag)).toBe(expected);
  });

  it('rejects release labels that are not version tags', () => {
    expect(() => normalizeTagVersion('release-next')).toThrow('is not a semantic or four-component Unity version');
  });
});

function input(overrides: Partial<Inputs> = {}): Inputs {
  return {
    projectPath: '.',
    target: 'StandaloneWindows64',
    outputPath: 'build/REVIVE.exe',
    profile: '',
    versioningStrategy: 'none',
    buildVersion: '',
    allowDirtyBuild: false,
    editorVersion: '',
    editorPath: '',
    architecture: '',
    allowInstall: false,
    cliVersion: '1.0.0-beta.4',
    logFile: '',
    quiet: false,
    args: '',
    ...overrides,
  };
}
