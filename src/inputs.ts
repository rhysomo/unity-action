import * as core from '@actions/core';

export function inputs(): Inputs {
  return {
    projectPath: core.getInput('project-path') || '.',
    target: core.getInput('target'),
    outputPath: core.getInput('output-path', { required: true }),
    profile: core.getInput('profile'),
    versioningStrategy: core.getInput('versioning-strategy') || 'none',
    buildVersion: core.getInput('build-version', { trimWhitespace: false }),
    allowDirtyBuild: core.getBooleanInput('allow-dirty-build'),
    editorVersion: core.getInput('editor-version'),
    editorPath: core.getInput('editor-path'),
    architecture: core.getInput('architecture'),
    allowInstall: core.getBooleanInput('allow-install'),
    cliVersion: core.getInput('cli-version', { required: true }),
    logFile: core.getInput('log-file'),
    args: core.getInput('args', { trimWhitespace: false }),
  };
}

export interface Inputs {
  projectPath: string;
  target: string;
  outputPath: string;
  profile: string;
  versioningStrategy: string;
  buildVersion: string;
  allowDirtyBuild: boolean;
  editorVersion: string;
  editorPath: string;
  architecture: string;
  allowInstall: boolean;
  cliVersion: string;
  logFile: string;
  args: string;
}
