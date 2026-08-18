import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { mkdir, mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { buildArguments, resolveBuild } from './build.js';
import { prepareCli } from './cli.js';
import { inputs } from './inputs.js';
import { withProjectVersion } from './version.js';

async function main(): Promise<void> {
  const input = inputs();
  const projectPath = resolve(input.projectPath);
  await requireUnityProject(projectPath);

  const cli = await core.group('Prepare Unity CLI', () => prepareCli(input.cliVersion));
  const request = resolveBuild(input);
  const outputPath = fromProject(projectPath, request.outputPath);
  const logPath = await buildLogPath(projectPath, input.logFile);
  const tag = request.versioningStrategy === 'tag' ? await currentTag(projectPath) : '';
  const nativeVersioning = !request.executeMethod && ['tag', 'custom'].includes(request.versioningStrategy);
  const command = buildArguments({ ...request, outputPath }, logPath, tag);

  if (nativeVersioning && !request.allowDirtyBuild) await requireCleanWorktree(projectPath);

  core.setOutput('output-path', outputPath);
  core.setOutput('output-directory', dirname(outputPath));
  core.setOutput('log-path', logPath);
  core.setOutput('build-version', command.buildVersion);
  core.setOutput('cli-version', cli.version);

  await withProjectVersion(projectPath, nativeVersioning ? command.buildVersion : '', async () => {
    core.info(`Building ${projectPath}`);
    const exitCode = await exec.exec(cli.path, command.args, {
      cwd: projectPath,
      ignoreReturnCode: true,
    });

    if (exitCode !== 0) throw new Error(`Unity CLI exited with code ${exitCode}. Build log: ${logPath}`);

    const output = await stat(outputPath).catch(() => null);
    if (!output) throw new Error(`Unity CLI succeeded, but output-path was not created: ${outputPath}`);

    core.info(`Unity build completed: ${outputPath}`);
  });
}

async function requireUnityProject(projectPath: string): Promise<void> {
  const versionFile = join(projectPath, 'ProjectSettings', 'ProjectVersion.txt');
  const status = await stat(versionFile).catch(() => null);
  if (!status?.isFile()) throw new Error(`project-path is not a Unity project: ${projectPath}`);
}

async function buildLogPath(projectPath: string, input: string): Promise<string> {
  if (input) {
    const path = fromProject(projectPath, input);
    await mkdir(dirname(path), { recursive: true });
    return path;
  }

  const directory = await mkdtemp(join(process.env.RUNNER_TEMP ?? tmpdir(), 'unity-action-'));
  return join(directory, 'build.log');
}

async function currentTag(projectPath: string): Promise<string> {
  if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME) return process.env.GITHUB_REF_NAME;

  const result = await exec.getExecOutput('git', ['describe', '--tags', '--abbrev=0'], {
    cwd: projectPath,
    ignoreReturnCode: true,
    silent: true,
  });

  const tag = result.stdout.trim();
  if (result.exitCode !== 0 || !tag) {
    throw new Error('versioning-strategy tag requires a reachable Git tag.');
  }

  return tag;
}

async function requireCleanWorktree(projectPath: string): Promise<void> {
  const result = await exec.getExecOutput('git', ['status', '--porcelain=v1'], {
    cwd: projectPath,
    ignoreReturnCode: true,
    silent: true,
  });

  if (result.exitCode !== 0) throw new Error('Could not inspect the Git worktree before applying the build version.');
  if (result.stdout.trim()) {
    throw new Error('Build versioning requires a clean Git worktree; set allow-dirty-build to override.');
  }
}

function fromProject(projectPath: string, path: string): string {
  return isAbsolute(path) ? path : resolve(projectPath, path);
}

main().catch((error: unknown) => core.setFailed(error instanceof Error ? error : String(error)));
