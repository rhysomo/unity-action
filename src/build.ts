import { valid } from 'semver';
import { parseArgsStringToArgv } from 'string-argv';
import type { Inputs } from './inputs.js';

const valueOptions = new Map<string, ValueOption>([
  ['--target', 'target'],
  ['--output-path', 'outputPath'],
  ['-o', 'outputPath'],
  ['--profile', 'profile'],
  ['--versioning-strategy', 'versioningStrategy'],
  ['--build-version', 'buildVersion'],
  ['--editor-version', 'editorVersion'],
  ['--editor-path', 'editorPath'],
  ['-e', 'editorPath'],
  ['--architecture', 'architecture'],
  ['-a', 'architecture'],
]);

const reservedOptions = new Set(['--log-file', '-l', '--no-tail', '--quiet', '--format', '--json']);

export function resolveBuild(inputs: Inputs): BuildRequest {
  const tokens = parseArgsStringToArgv(inputs.args);
  const values: Partial<Record<ValueOption, string>> = {};
  const extraArgs: string[] = [];
  let allowDirtyBuild = inputs.allowDirtyBuild;
  let allowInstall = inputs.allowInstall;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;

    const separator = token.indexOf('=');
    const name = separator < 0 ? token : token.slice(0, separator);
    const inlineValue = separator < 0 ? undefined : unquote(token.slice(separator + 1));

    if (reservedOptions.has(name)) {
      throw new Error(`${name} is managed by unity-action and cannot be passed through args.`);
    }

    const option = valueOptions.get(name);
    if (option) {
      const value = inlineValue ?? tokens[index + 1];
      if (value === undefined) throw new Error(`${name} requires a value.`);
      if (inlineValue === undefined) index += 1;
      values[option] = value;
      continue;
    }

    if (name === '--allow-dirty-build') {
      allowDirtyBuild = true;
      continue;
    }

    if (name === '--allow-install') {
      allowInstall = true;
      continue;
    }

    extraArgs.push(inlineValue === undefined ? token : `${name}=${inlineValue}`);
  }

  const versioningStrategy = strategy(values.versioningStrategy ?? inputs.versioningStrategy);

  return {
    target: values.target ?? inputs.target,
    outputPath: values.outputPath ?? inputs.outputPath,
    profile: values.profile ?? inputs.profile,
    versioningStrategy,
    buildVersion: values.buildVersion ?? inputs.buildVersion,
    allowDirtyBuild,
    editorVersion: values.editorVersion ?? inputs.editorVersion,
    editorPath: values.editorPath ?? inputs.editorPath,
    architecture: values.architecture ?? inputs.architecture,
    allowInstall,
    extraArgs,
  };
}

export function buildArguments(request: BuildRequest, logPath: string, tagVersion = ''): BuildCommand {
  if (!request.outputPath.trim()) throw new Error('output-path must not be empty.');
  if (!request.target && !request.profile) {
    throw new Error('Provide target or profile, either as an input or through args.');
  }

  const args = ['--no-banner', '--non-interactive', 'build', '.', '--output-path', request.outputPath];
  if (request.target) args.push('--target', request.target);
  if (request.profile) args.push('--profile', request.profile);
  if (request.editorVersion) args.push('--editor-version', request.editorVersion);
  if (request.editorPath) args.push('--editor-path', request.editorPath);
  if (request.architecture) args.push('--architecture', request.architecture);
  if (request.allowInstall) args.push('--allow-install');

  let buildVersion = '';
  if (request.versioningStrategy === 'tag') {
    if (!tagVersion) throw new Error('A Git tag is required for versioning-strategy tag.');
    buildVersion = normalizeTagVersion(tagVersion);
    args.push('--versioning-strategy', 'custom', '--build-version', buildVersion);
  } else {
    args.push('--versioning-strategy', request.versioningStrategy);
    if (request.versioningStrategy === 'custom') {
      if (!request.buildVersion) throw new Error('build-version is required for versioning-strategy custom.');
      buildVersion = request.buildVersion;
      args.push('--build-version', buildVersion);
    }
  }

  if (request.allowDirtyBuild) args.push('--allow-dirty-build');
  args.push('--log-file', logPath, ...request.extraArgs);

  return { args, buildVersion };
}

export function normalizeTagVersion(tag: string): string {
  const value = tag.trim();
  const candidate = value.startsWith('v') ? value.slice(1) : value;

  if (valid(candidate) || /^\d+\.\d+\.\d+\.\d+$/.test(candidate)) return candidate;

  throw new Error(`Tag '${tag}' is not a semantic or four-component Unity version tag.`);
}

function strategy(value: string): VersioningStrategy {
  if (value === 'none' || value === 'tag' || value === 'semantic' || value === 'custom') return value;

  throw new Error(`versioning-strategy must be none, tag, semantic, or custom; got '${value}'.`);
}

function unquote(value: string): string {
  const quote = value[0];
  return value.length >= 2 && (quote === '"' || quote === "'") && value.at(-1) === quote ? value.slice(1, -1) : value;
}

export interface BuildRequest {
  target: string;
  outputPath: string;
  profile: string;
  versioningStrategy: VersioningStrategy;
  buildVersion: string;
  allowDirtyBuild: boolean;
  editorVersion: string;
  editorPath: string;
  architecture: string;
  allowInstall: boolean;
  extraArgs: string[];
}

export interface BuildCommand {
  args: string[];
  buildVersion: string;
}

type VersioningStrategy = 'none' | 'tag' | 'semantic' | 'custom';
type ValueOption =
  | 'target'
  | 'outputPath'
  | 'profile'
  | 'versioningStrategy'
  | 'buildVersion'
  | 'editorVersion'
  | 'editorPath'
  | 'architecture';
