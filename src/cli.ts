import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as toolCache from '@actions/tool-cache';
import { createHash } from 'node:crypto';
import { chmod, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { valid } from 'semver';

const cdn = 'https://public-cdn.cloud.unity3d.com/hub/prod/cli';
const toolName = 'unity-cli';

export async function prepareCli(requested: string): Promise<Cli> {
  const installed = await io.which('unity', false);

  if (requested === 'installed') {
    if (!installed) throw new Error("cli-version is 'installed', but unity was not found on PATH.");

    const version = await cliVersion(installed);
    if (!version) throw new Error(`Could not read the Unity CLI version from ${installed}.`);
    return { path: installed, version };
  }

  if (requested !== 'latest-beta' && !valid(requested)) {
    throw new Error(`cli-version must be an exact semantic version, latest-beta, or installed; got '${requested}'.`);
  }

  const manifest = requested === 'latest-beta' ? await fetchManifest('latest-beta.json') : null;
  const version = manifest?.version ?? requested;

  if (installed && (await cliVersion(installed)) === version) return { path: installed, version };

  const cached = toolCache.find(toolName, version, process.arch);
  if (cached) {
    const path = join(cached, executableName());
    const actual = await cliVersion(path);
    if (actual !== version) throw new Error(`Cached Unity CLI ${version} is invalid: ${path}`);
    core.addPath(cached);
    return { path, version };
  }

  const release = manifest ?? (await fetchManifest(`${version}/latest.json`));
  if (release.version !== version) {
    throw new Error(`Unity CLI manifest version mismatch: requested ${version}, received ${release.version}.`);
  }

  const binary = release.binary;
  const download = await toolCache.downloadTool(`${cdn}/${version}/${binary.filename}`);
  const digest = createHash('sha256')
    .update(await readFile(download))
    .digest('hex');
  if (digest !== binary.sha256) {
    throw new Error(`Unity CLI checksum mismatch: expected ${binary.sha256}, received ${digest}.`);
  }

  const directory = await toolCache.cacheFile(download, executableName(), toolName, version, process.arch);
  const path = join(directory, executableName());
  if (process.platform !== 'win32') await chmod(path, 0o755);

  const actual = await cliVersion(path);
  if (actual !== version)
    throw new Error(`Installed Unity CLI version mismatch: expected ${version}, received ${actual}.`);

  core.addPath(directory);
  return { path, version };
}

export function parseManifest(value: unknown, platform: string): CliManifest {
  if (!record(value) || typeof value.version !== 'string' || !record(value.binaries)) {
    throw new Error('Unity CLI manifest is missing version or binaries.');
  }

  if (!valid(value.version)) throw new Error(`Unity CLI manifest contains an invalid version: ${value.version}.`);

  const binary = value.binaries[platform];
  if (!record(binary) || typeof binary.filename !== 'string' || typeof binary.sha256 !== 'string') {
    throw new Error(`Unity CLI manifest has no binary for ${platform}.`);
  }

  if (basename(binary.filename) !== binary.filename || !/^[a-f0-9]{64}$/.test(binary.sha256)) {
    throw new Error(`Unity CLI manifest contains an invalid binary entry for ${platform}.`);
  }

  return {
    version: value.version,
    binary: { filename: binary.filename, sha256: binary.sha256 },
  };
}

export function cliPlatform(platform: NodeJS.Platform, architecture: string): string {
  const operatingSystem = platform === 'win32' ? 'win32' : platform;
  const processor = architecture === 'x64' || architecture === 'arm64' ? architecture : '';

  if ((operatingSystem !== 'win32' && operatingSystem !== 'darwin' && operatingSystem !== 'linux') || !processor) {
    throw new Error(`Unity CLI is not available for ${platform}-${architecture}.`);
  }

  return `${operatingSystem}-${processor}`;
}

async function fetchManifest(path: string): Promise<CliManifest> {
  const response = await fetch(`${cdn}/${path}`);
  if (!response.ok) throw new Error(`Unity CLI manifest download failed with HTTP ${response.status}.`);

  const value: unknown = await response.json();
  return parseManifest(value, cliPlatform(process.platform, process.arch));
}

async function cliVersion(path: string): Promise<string | null> {
  const result = await exec.getExecOutput(path, ['--version'], {
    ignoreReturnCode: true,
    silent: true,
  });

  return result.exitCode === 0 ? (result.stdout.trim().split(/\s+/)[0] ?? null) : null;
}

function executableName(): string {
  return process.platform === 'win32' ? 'unity.exe' : 'unity';
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface Cli {
  path: string;
  version: string;
}

export interface CliManifest {
  version: string;
  binary: {
    filename: string;
    sha256: string;
  };
}
