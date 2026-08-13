# Unity Build

공식 [Unity CLI](https://docs.unity.com/en-us/unity-cli)를 설치하고 `unity build`로 Unity 프로젝트를
빌드하는 GitHub Action입니다. 별도 build method나 `com.unity.pipeline` 패키지가 필요하지 않습니다.

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

`unity build`가 Editor를 batch mode로 실행하고, 로그를 파일에 기록하는 동시에 Actions 로그로
전달하며, Editor 종료 코드를 반환합니다. 이 액션은 그 동작을 다시 구현하지 않습니다.

## 입력값

| 이름                  | 필수   | 기본값         | 설명                                                                      |
| --------------------- | ------ | -------------- | ------------------------------------------------------------------------- |
| `project-path`        | 아니오 | `.`            | Unity 프로젝트 디렉터리.                                                  |
| `target`              | 조건부 | —              | Unity `BuildTarget`. `profile`이 없으면 필요합니다.                       |
| `output-path`         | 예     | —              | 최종 Player 경로. 상대 경로는 `project-path` 기준입니다.                  |
| `profile`             | 조건부 | —              | Unity 6 Build Profile 이름 또는 `.asset` 경로.                            |
| `versioning-strategy` | 아니오 | `none`         | `none`, `tag`, `semantic`, `custom` 중 하나.                              |
| `build-version`       | 조건부 | —              | `custom` 전략의 버전.                                                     |
| `allow-dirty-build`   | 아니오 | `false`        | Unity CLI의 Git dirty guard를 해제합니다.                                 |
| `editor-version`      | 아니오 | 프로젝트 설정  | 사용할 Editor 버전.                                                       |
| `editor-path`         | 아니오 | 자동 탐색      | 특정 Unity Editor 실행 파일 경로.                                         |
| `architecture`        | 아니오 | 자동 탐색      | Editor 아키텍처 (`x86_64` 또는 `arm64`).                                  |
| `allow-install`       | 아니오 | `false`        | 필요한 Editor가 없을 때 Unity CLI의 자동 설치를 허용합니다.               |
| `cli-version`         | 아니오 | `1.0.0-beta.4` | 정확한 Unity CLI 버전, `latest-beta`, 또는 `installed`.                   |
| `log-file`            | 아니오 | 임시 경로      | 빌드 로그 경로. 상대 경로는 `project-path` 기준입니다.                    |
| `args`                | 아니오 | —              | 추가 `unity build` 인자. 아래의 승격된 입력과 겹치면 `args`가 우선합니다. |

`target`과 `profile`은 둘 중 하나가 필요합니다. Build Profile을 사용하지 않는 일반 빌드는 `profile`을
생략하세요. `output-path`는 디렉터리가 아니라 플랫폼이 요구하는 최종 위치를 적습니다.

```yaml
# macOS
target: StandaloneOSX
output-path: build/StandaloneOSX/REVIVE.app

# Windows
target: StandaloneWindows64
output-path: build/Windows/REVIVE.exe

# WebGL 또는 iOS처럼 디렉터리를 출력하는 플랫폼
target: WebGL
output-path: build/WebGL
```

## 추가 CLI 인자

자주 쓰는 인자는 입력으로 승격했고, 나머지는 `args`로 공식 CLI에 전달합니다. 승격된 옵션을
`args`에도 적으면 Tauri Action과 같은 방식으로 `args`의 값이 우선합니다.

```yaml
with:
  target: Android
  output-path: build/REVIVE.aab
  args: >-
    --android-export-type aab
    --android-target-sdk-version 35
    --android-symbol-type public
```

액션의 로그 및 output 계약을 보장하기 위해 다음 옵션은 `args`에서 사용할 수 없습니다.

- `--log-file`, `-l`
- `--no-tail`
- `--quiet`
- `--format`, `--json`

필요하면 `log-file` 입력을 사용하세요. Unity Editor로 전달할 raw 인자는 공식 CLI의 `--args`를
`args` 안에서 사용할 수 있습니다.

## 버저닝

`none`, `semantic`, `custom`은 공식 Unity CLI 동작을 그대로 사용합니다. `tag`만 배포 태그와 앱
버전을 구분하기 위해 액션이 정규화합니다.

```text
v1.2.3            -> 1.2.3
v1.2.3-rc.1       -> 1.2.3-rc.1
v1.2.3.4          -> 1.2.3.4
```

내부적으로 정규화된 값을 `--versioning-strategy custom --build-version <version>`으로 전달합니다.
GitHub tag 이벤트에서는 `GITHUB_REF_NAME`을 사용하고, 그 외에는 공식 CLI의 tag 전략처럼
`git describe --tags --abbrev=0`으로 가장 가까운 tag를 찾습니다. `semantic` 전략은 공식 CLI가 계산한
버전을 그대로 사용하므로 `build-version` output은 비어 있습니다.

## 출력값

| 이름               | 설명                                                 |
| ------------------ | ---------------------------------------------------- |
| `output-path`      | 최종 Player의 절대 경로.                             |
| `output-directory` | `output-path`를 포함하는 절대 디렉터리.              |
| `log-path`         | Unity 빌드 로그의 절대 경로. 실패 시에도 설정됩니다. |
| `build-version`    | `tag` 또는 `custom`으로 확정된 버전.                 |
| `cli-version`      | 실제 사용한 Unity CLI 버전.                          |

액션은 로그 artifact를 자동 업로드하지 않습니다. 실패 로그를 장기 보관하려면 workflow에서
`if: failure()`와 `log-path`를 사용하세요.

## Unity CLI, Editor, 라이선스

- 이 액션은 `node24` 런타임을 사용합니다. self-hosted GitHub Actions Runner는 `2.327.1` 이상이어야
  합니다.
- 정확한 `cli-version`은 runner tool cache를 사용하고, Unity 배포 manifest의 SHA-256으로 다운로드를
  검증합니다. `latest-beta`는 실행 시점의 최신 beta이므로 재현 가능한 빌드에는 고정 버전을 권장합니다.
- `cli-version: installed`는 PATH의 `unity`를 그대로 사용하며 다운로드하지 않습니다.
- Editor와 플랫폼 모듈은 runner에 미리 설치하는 것이 기본입니다. 임시 runner에서만
  `allow-install: true`를 고려하세요.
- 이 액션은 Unity 계정이나 라이선스를 활성화·반납하지 않습니다. self-hosted runner는 공식 Unity CLI
  또는 Hub로 미리 로그인하고 유효한 라이선스를 활성화하세요. ephemeral runner는 별도 workflow
  단계에서 공식 `unity license` 명령으로 라이선스를 준비한 뒤 `cli-version: installed`를 사용하세요.
- Unity CLI는 아직 experimental입니다. 기본 버전 변경은 release note와 실제 빌드 smoke test를 거쳐
  액션의 새 release로 배포합니다.

## 개발

```bash
corepack enable
pnpm install
pnpm check
pnpm build
```

GitHub는 dependency를 설치하지 않고 `dist/index.js`를 직접 실행합니다. `src/`가 바뀌면 `dist/`도
다시 빌드해 함께 커밋하세요. 액션은 Node.js 24 runner를 사용합니다.

## 릴리스

모든 검증과 실제 Unity 빌드 smoke test가 통과한 commit에 `v1.0.0` 같은 immutable tag를 만들고,
동일한 commit으로 `v1` major tag를 이동합니다. 사용자는 재현성을 위해 immutable tag나 commit SHA를
고정할 수 있습니다.

## 라이선스

[MIT](LICENSE)
