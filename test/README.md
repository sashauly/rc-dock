# Testing

Tests import TypeScript source directly. The library build and Parcel examples are independent of this setup. Vitest uses Vite internally to transform tests and serve browser fixtures; there is no application build migration.

Use a supported Node release such as 22 or 24 for the test tooling; this suite was verified with Node 22.21. This does not change the library's runtime compatibility or introduce a Node/package-manager version pin. Install dependencies with the existing Yarn workflow:

```sh
yarn install --frozen-lockfile
yarn test:install-browser
```

The second command downloads Chromium through Playwright. On Linux, if Playwright reports missing system libraries, install them with `yarn playwright install-deps chromium` using the permissions required by your system.

## Commands

| Command | Purpose |
| --- | --- |
| `yarn test` | Watch Node and jsdom tests without launching a browser |
| `yarn test:run` | Run all three projects once, including headless Chromium |
| `yarn test:unit` | Run algorithms and serialization tests |
| `yarn test:dom` | Run React interaction tests in jsdom |
| `yarn test:browser` | Run real-browser tests once, headlessly |
| `yarn test:browser:watch` | Watch browser tests in a visible Chromium window |
| `yarn test:typecheck` | Type-check configuration, fixtures, tests and imported source |
| `yarn typecheck` | Check the complete workspace with TypeScript 7, matching the editor |

To run a single test file or test name:

```sh
yarn test:dom test/dom/tabs.test.tsx
yarn test:browser -t 'native dragging'
```

All run commands return a nonzero status when a test fails. `test:typecheck` is a separate required check: Vitest's TypeScript transpilation does not report type errors.

## TypeScript

Configuration is in `vitest.config.mts` (explicit TypeScript ESM); test compiler options are in `tsconfig.test.json`. Tests and fixtures use `.ts`/`.tsx`, with explicit imports from Vitest and typed library APIs. The `.mts` extension keeps the package's existing CommonJS configuration intact. The root `tsconfig.json` includes source, tests, tools and the Vitest configuration so VS Code discovers them as one configured project.

The existing library build and TypeDoc retain TypeScript 4.2 and use `tsconfig.build.json`. The `typescript-test` dependency supplies TypeScript 7.0.2 for the workspace and tests, matching the editor's compiler generation. Both build scripts and the type-check commands invoke their compiler explicitly: the two packages expose the same `tsc` executable name, so the package-manager bin link is ambiguous. Use the scripts rather than a bare `tsc` command. Do not change the library compiler merely to accommodate a new test helper.

The legacy project's existing non-strict baseline is explicit because TypeScript 7 changes the default; `noImplicitAny` remains enabled. This setup does not convert production source to strict null checking. Side-effect import checking is enabled for the modern project, and `assets.d.ts` declares Sass imports handled by the browser bundler.

Consumer declaration regressions, such as #8, need compiler checks in addition to runtime tests. Add `.ts`/`.tsx` consumer fixtures that import the relevant source types and include them in `tsconfig.test.json`. Use `@ts-expect-error` only for deliberately invalid usage; valid consumer code must compile without casts. Published declaration compatibility, when relevant, should be checked against generated declarations in its own targeted check.

## Test locations and boundaries

- `unit/`: Node tests for algorithms, serialization and data contracts.
- `dom/`: React rendering, activation, focus, callbacks and lifecycle behavior.
- `browser/`: native input, actual layout, hit testing, dragging and resizing.
- `fixtures/`: typed, deterministic application fixtures shared by DOM and browser tests.
- `setup/`: environment-specific cleanup and platform fixtures.

The initial tests exercise layout serialization, tab activation and native tab reordering. Bug-specific coverage belongs with the corresponding fix; this infrastructure does not fix #2–#9 or #11.

jsdom has no layout engine. Its ResizeObserver fixture does not simulate layout or deliver measurements. Assert geometry in the browser project, which loads source SCSS and uses real browser APIs. Keep platform stubs scoped to jsdom; do not replace the drag engine or the methods whose behavior a test is meant to verify.

Browser tests use Vitest's Playwright provider and `userEvent` for native input. They can also use typed browser commands when a regression needs precise pointer movement. Assert tab ownership/order, position/size and callback outcomes through the public layout API and rendered UI. A final layout assertion cannot establish that resizing updated before release; live-resize regressions must also observe the intermediate state.

Screenshot baselines are not part of the initial suite. Add selected visual comparisons later when the expected indicator/overlay appearance is stable. Failed browser-test artifacts are kept in `.vitest/` and ignored by Git.

CI/CD, publishing and package-manager version policies remain separate work.
