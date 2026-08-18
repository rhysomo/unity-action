# Unity Build

A GitHub Action that installs the official [Unity CLI](https://docs.unity.com/en-us/unity-cli) and builds Unity projects
with `unity build`. It does not require a custom build method or the `com.unity.pipeline` package.

```yaml
- uses: actions/checkout@v6

- name: Build Windows Player
  id: unity
  uses: insd47/unity-action@v1
  with:
    target: StandaloneWindows64
    output-path: build/Windows/REVIVE.exe
    versioning-strategy: tag

- uses: actions/upload-artifact@v7
  with:
    name: REVIVE-Windows
    path: ${{ steps.unity.outputs.output-directory }}
```

`unity build` launches the Editor in batch mode, streams its log to the Actions log, writes the complete log to a
file, and returns the Editor exit code.

## Inputs

| Name                  | Required    | Default        | Description                                                                            |
| --------------------- | ----------- | -------------- | -------------------------------------------------------------------------------------- |
| `project-path`        | No          | `.`            | Unity project directory.                                                               |
| `target`              | Conditional | —              | Unity `BuildTarget`. Required when `profile` is not provided.                          |
| `output-path`         | Yes         | —              | Final Player path, relative to `project-path` or absolute.                             |
| `profile`             | Conditional | —              | Unity 6 Build Profile name or `.asset` path.                                           |
| `versioning-strategy` | No          | `none`         | One of `none`, `tag`, `semantic`, or `custom`. `semantic` requires `--execute-method`. |
| `build-version`       | Conditional | —              | Version used by the `custom` strategy.                                                 |
| `allow-dirty-build`   | No          | `false`        | Allow versioning when the Git worktree has uncommitted changes.                        |
| `editor-version`      | No          | Project config | Override the Editor version.                                                           |
| `editor-path`         | No          | Auto-detected  | Path to a specific Unity Editor executable.                                            |
| `architecture`        | No          | Auto-detected  | Editor architecture (`x86_64` or `arm64`).                                             |
| `allow-install`       | No          | `false`        | Allow the Unity CLI to install a missing Editor.                                       |
| `cli-version`         | No          | `1.0.0-beta.4` | Exact Unity CLI version, `latest-beta`, or `installed`.                                |
| `log-file`            | No          | Temporary path | Build log path, relative to `project-path` or absolute.                                |
| `quiet`               | No          | `false`        | Disable console log streaming while preserving the complete log file.                  |
| `args`                | No          | —              | Additional `unity build` arguments. Promoted options in `args` override their inputs.  |

Provide either `target` or `profile`. Omit `profile` for a regular build that does not use a Build Profile.
`output-path` is the final platform-specific output location, not necessarily a directory.

```yaml
# macOS
target: StandaloneOSX
output-path: build/StandaloneOSX/REVIVE.app

# Windows
target: StandaloneWindows64
output-path: build/Windows/REVIVE.exe

# Platforms such as WebGL and iOS produce a directory
target: WebGL
output-path: build/WebGL
```

## Additional CLI arguments

Common options are exposed as inputs. All other options are passed to the official CLI through `args`. When a promoted
option is also present in `args`, the value from `args` takes precedence.

```yaml
with:
  target: Android
  output-path: build/REVIVE.aab
  args: >-
    --android-export-type aab
    --android-target-sdk-version 35
    --android-symbol-type public
```

The following options cannot be passed through `args` because the action manages its logging and output contract:

- `--log-file`, `-l`
- `--no-tail`
- `--quiet`
- `--format`, `--json`

By default, the Editor log streams to the Actions log in real time. Set `quiet: true` to disable the stream and
suppress informational Unity CLI output. The complete build log is still written to `log-file`. To pass raw arguments
to the Unity Editor, include the official CLI's `--args` option inside this action's `args` input.

## Versioning

For the CLI's built-in build, the action resolves `tag` and `custom` versions and temporarily stamps
`PlayerSettings.bundleVersion` in `ProjectSettings/ProjectSettings.asset`. The original file is restored after the
build succeeds or fails, and the action rejects a pre-existing dirty worktree unless `allow-dirty-build` is enabled.
Versioned Build Profile builds require `--execute-method` because a profile can override the global Player Settings.

```text
v1.2.3            -> 1.2.3
v1.2.3-rc.1       -> 1.2.3-rc.1
v1.2.3.4          -> 1.2.3.4
```

On GitHub tag events, the action uses `GITHUB_REF_NAME`. Otherwise, it finds the nearest tag with
`git describe --tags --abbrev=0`. `semantic` requires a custom build method because the Unity CLI only applies that
strategy with `--execute-method`.

When `args` includes `--execute-method`, the action delegates `tag`, `custom`, and `semantic` to the Unity CLI instead
of changing `ProjectSettings.asset`. The custom method owns the Player build and must honor the CLI's forwarded output
path.

## Outputs

| Name               | Description                                                        |
| ------------------ | ------------------------------------------------------------------ |
| `output-path`      | Absolute path to the final Player.                                 |
| `output-directory` | Absolute path to the directory containing `output-path`.           |
| `log-path`         | Absolute path to the Unity build log. Set before the build starts. |
| `build-version`    | Resolved version for the `tag` and `custom` strategies.            |
| `cli-version`      | Unity CLI version used by the action.                              |

The action does not upload the log automatically. To retain failed build logs, upload `log-path` from a workflow step
guarded by `if: failure()`.

## Unity CLI, Editor, and licensing

- This action runs on `node24`. Self-hosted GitHub Actions runners must be version `2.327.1` or later.
- An exact `cli-version` uses the runner tool cache and verifies the download against the SHA-256 digest from the Unity
  release manifest. `latest-beta` changes over time, so pin an exact version for reproducible builds.
- `cli-version: installed` uses `unity` from `PATH` without downloading it.
- Preinstall the Editor and platform modules on persistent runners. Consider `allow-install: true` only on ephemeral
  runners.
- This action does not activate or return Unity licenses. On persistent self-hosted runners, sign in and activate a
  valid license with the official Unity CLI or Hub. On ephemeral runners, prepare the license in a separate workflow
  step with the official `unity license` command, then use `cli-version: installed`.
- The Unity CLI is experimental. Test CLI version upgrades with a real build before publishing a new action release.

## Development

```bash
corepack enable
pnpm install
pnpm check
pnpm build
```

GitHub executes `dist/index.js` directly without installing dependencies. After changing `src/`, rebuild and commit
`dist/` with the source changes. The action uses the Node.js 24 runner.

## Releases

After every check and a real Unity build smoke test pass, create an immutable tag such as `v1.0.0` and move the `v1`
major tag to the same commit. Consumers can pin an immutable tag or commit SHA for reproducibility.

## License

[MIT](LICENSE)
