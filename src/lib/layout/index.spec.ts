let mockedStdoutBuffer: string = ''
const mockStdout = jest.spyOn(process.stdout, 'write').mockImplementation((data) => {
  mockedStdoutBuffer += data
  return true
})

afterEach(() => {
  mockedStdoutBuffer = ''
})

const mockExit = jest.spyOn(process, 'exit').mockImplementation(((n: any) => {
  mockedStdoutBuffer += `\n\n--- process.exit(${n}) ---\n\n`
}) as any)

import { TsConfigJson } from 'type-fest'
import * as Layout from '.'
import { rootLogger } from '../../lib/nexus-logger'
import { FSSpec, writeFSSpec } from '../../lib/testing-utils'
import * as TestContext from '../test-context'
import { repalceInObject } from '../utils'

/**
 * Disable logger timeDiff and color to allow snapshot matching
 */
rootLogger.settings({
  pretty: {
    enabled: true,
    timeDiff: false,
    color: false,
  },
})

/**
 * Helpers
 */

function tsconfigContent(input: TsConfigJson): string {
  return JSON.stringify(input)
}

const fsTsConfig = {
  'tsconfig.json': tsconfigContent({ compilerOptions: { rootDir: '.' }, include: ['.'] }),
}

const layoutContext = TestContext.create((input: TestContext.TmpDirContribution) => {
  return {
    setup(spec: FSSpec = {}) {
      writeFSSpec(input.tmpDir, spec)
    },
    async scan() {
      const data = await Layout.create({ cwd: input.tmpDir })
      mockedStdoutBuffer = mockedStdoutBuffer.split(input.tmpDir).join('__DYNAMIC__')
      return repalceInObject(input.tmpDir, '__DYNAMIC__', data.data)
    },
  }
})

const ctx = TestContext.compose(TestContext.tmpDir, TestContext.fs, layoutContext)

/**
 * Tests
 */

it('fails if empty file tree', async () => {
  ctx.setup()

  try {
    await ctx.scan()
  } catch (err) {
    expect(err.message).toContain("Path you want to find stuff in doesn't exist")
  }
})

describe('tsconfig', () => {
  beforeEach(() => {
    ctx.setup({ 'app.ts': '' })
  })

  it('will scaffold tsconfig if not present', async () => {
    await ctx.scan()
    expect(mockedStdoutBuffer).toMatchInlineSnapshot(`
      "▲ nexus:tsconfig We could not find a \\"tsconfig.json\\" file
      ▲ nexus:tsconfig We scaffolded one for you at __DYNAMIC__/tsconfig.json
      "
    `)
    expect(ctx.fs.read('tsconfig.json', 'json')).toMatchInlineSnapshot(`
      Object {
        "compilerOptions": Object {
          "lib": Array [
            "esnext",
          ],
          "module": "commonjs",
          "rootDir": ".",
          "strict": true,
          "target": "es2016",
        },
        "include": Array [
          ".",
        ],
      }
    `)
  })

  it('will warn if reserved settings are in use', async () => {
    ctx.setup({
      'tsconfig.json': tsconfigContent({
        compilerOptions: { rootDir: '.', incremental: true, tsBuildInfoFile: 'foo' },
        include: ['.'],
      }),
    })
    await ctx.scan()
    expect(mockedStdoutBuffer).toMatchInlineSnapshot(`
      "▲ nexus:tsconfig You have set compilerOptions.tsBuildInfoFile in your tsconfig.json but it will be ignored by Nexus. Nexus manages this value internally.
      ▲ nexus:tsconfig You have set compilerOptions.incremental in your tsconfig.json but it will be ignored by Nexus. Nexus manages this value internally.
      "
    `)
  })

  it('will warn if required settings are not set and set them in memory', async () => {
    ctx.setup({
      'tsconfig.json': '',
    })
    const layout = await ctx.scan()
    expect(mockedStdoutBuffer).toMatchInlineSnapshot(`
      "▲ nexus:tsconfig Please set your tsconfig.json compilerOptions.rootDir to \\".\\"
      ▲ nexus:tsconfig Please set your tsconfig.json include to have \\".\\"
      "
    `)
    expect(layout.tsConfigJson.raw.compilerOptions.rootDir).toEqual('.')
    expect(layout.tsConfigJson.raw.include).toEqual(['.'])
  })

  it('will fatal message and exit if error reading file', async () => {
    ctx.setup({
      'tsconfig.json': 'bad json',
    })
    await ctx.scan()
    expect(mockedStdoutBuffer).toMatchInlineSnapshot(`
      "✕ nexus:tsconfig Unable to read your tsconifg.json

      ../../../../..__DYNAMIC__/tsconfig.json:1:1 - error TS1005: '{' expected.

      1 bad json
        ~~~



      --- process.exit(1) ---

      ▲ nexus:tsconfig Please set your tsconfig.json compilerOptions.rootDir to \\".\\"
      ▲ nexus:tsconfig Please set your tsconfig.json include to have \\".\\"
      "
    `)
  })

  it('will fatal message and exit if invalid tsconfig schema', async () => {
    ctx.setup({
      'tsconfig.json': '{ "exclude": "bad" }',
    })
    await ctx.scan()
    expect(mockedStdoutBuffer).toMatchInlineSnapshot(`
      "▲ nexus:tsconfig Please set your tsconfig.json compilerOptions.rootDir to \\".\\"
      ▲ nexus:tsconfig Please set your tsconfig.json include to have \\".\\"
      ✕ nexus:tsconfig Your tsconfig.json is invalid

      error TS5024: Compiler option 'exclude' requires a value of type Array.



      --- process.exit(1) ---

      "
    `)
  })
})

it('fails if no entrypoint and no graphql modules', async () => {
  ctx.setup({
    ...fsTsConfig,
    src: {
      'User.ts': '',
      'Post.ts': '',
    },
  })

  await ctx.scan()

  expect(mockedStdoutBuffer).toMatchInlineSnapshot(`
    "■ nexus:layout We could not find any graphql modules or app entrypoint
    ■ nexus:layout Please do one of the following:

      1. Create a (graphql.ts file and write your GraphQL type definitions in it.
      2. Create a graphql directory and write your GraphQL type definitions inside files there.
      3. Create an app.ts file.


    --- process.exit(1) ---

    "
  `)
  expect(mockExit).toHaveBeenCalledWith(1)
})

it('finds nested graphql modules', async () => {
  ctx.setup({
    ...fsTsConfig,
    src: {
      'app.ts': '',
      graphql: {
        '1.ts': '',
        '2.ts': '',
        graphql: {
          '3.ts': '',
          '4.ts': '',
          graphql: {
            '5.ts': '',
            '6.ts': '',
          },
        },
      },
    },
  })

  const result = await ctx.scan()

  expect(result).toMatchInlineSnapshot(`
    Object {
      "app": Object {
        "exists": true,
        "path": "__DYNAMIC__/src/app.ts",
      },
      "buildOutputRelative": "node_modules/.build",
      "packageJson": Object {
        "dir": "__DYNAMIC__",
        "path": "__DYNAMIC__/package.json",
      },
      "packageManagerType": "npm",
      "project": Object {
        "isAnonymous": true,
        "name": "anonymous",
      },
      "projectRoot": "__DYNAMIC__",
      "schemaModules": Array [
        "__DYNAMIC__/src/graphql/1.ts",
        "__DYNAMIC__/src/graphql/2.ts",
        "__DYNAMIC__/src/graphql/graphql/3.ts",
        "__DYNAMIC__/src/graphql/graphql/4.ts",
        "__DYNAMIC__/src/graphql/graphql/graphql/5.ts",
        "__DYNAMIC__/src/graphql/graphql/graphql/6.ts",
      ],
      "sourceRoot": "__DYNAMIC__",
      "startModuleInPath": "__DYNAMIC__/index.ts",
      "startModuleOutPath": "__DYNAMIC__/node_modules/.build/index.js",
      "tsConfigJson": Object {
        "compileOnSave": false,
        "configFileSpecs": Object {
          "excludeSpecs": Array [
            "node_modules/.build",
          ],
          "includeSpecs": Array [
            ".",
          ],
          "validatedExcludeSpecs": Array [
            "node_modules/.build",
          ],
          "validatedIncludeSpecs": Array [
            ".",
          ],
          "wildcardDirectories": Object {
            "__DYNAMIC__": 1,
          },
        },
        "errors": Array [],
        "fileNames": Array [
          "__DYNAMIC__/src/app.ts",
          "__DYNAMIC__/src/graphql/1.ts",
          "__DYNAMIC__/src/graphql/2.ts",
          "__DYNAMIC__/src/graphql/graphql/3.ts",
          "__DYNAMIC__/src/graphql/graphql/4.ts",
          "__DYNAMIC__/src/graphql/graphql/graphql/5.ts",
          "__DYNAMIC__/src/graphql/graphql/graphql/6.ts",
        ],
        "options": Object {
          "configFilePath": "__DYNAMIC__/tsconfig.json",
          "outDir": "__DYNAMIC__/node_modules/.build",
          "rootDir": "__DYNAMIC__",
        },
        "raw": Object {
          "compileOnSave": false,
          "compilerOptions": Object {
            "outDir": "node_modules/.build",
            "rootDir": ".",
          },
          "include": Array [
            ".",
          ],
        },
        "typeAcquisition": Object {
          "enable": false,
          "exclude": Array [],
          "include": Array [],
        },
        "wildcardDirectories": Object {
          "__DYNAMIC__": 1,
        },
      },
    }
  `)
})

it('detects yarn as package manager', async () => {
  ctx.setup({ ...fsTsConfig, 'app.ts': '', 'yarn.lock': '' })
  const result = await ctx.scan()
  expect(result.packageManagerType).toMatchInlineSnapshot(`"yarn"`)
})

it('finds app.ts entrypoint', async () => {
  ctx.setup({ ...fsTsConfig, 'app.ts': '' })
  const result = await ctx.scan()
  expect(result.app).toMatchInlineSnapshot(`
    Object {
      "exists": true,
      "path": "__DYNAMIC__/app.ts",
    }
  `)
})

it('set app.exists = false if no entrypoint', async () => {
  await ctx.setup({ ...fsTsConfig, 'graphql.ts': '' })
  const result = await ctx.scan()
  expect(result.app).toMatchInlineSnapshot(`
    Object {
      "exists": false,
      "path": null,
    }
  `)
})

describe('source root', () => {
  it('defaults to project dir', async () => {
    ctx.setup({ 'tsconfig.json': '' })
    const result = await ctx.scan()
    expect(result.sourceRoot).toEqual('__DYNAMIC__')
    expect(result.projectRoot).toEqual('__DYNAMIC__')
  })
  it('honours the value in tsconfig rootDir', async () => {
    ctx.setup({ 'tsconfig.json': tsconfigContent({ compilerOptions: { rootDir: 'api' } }) })
    const result = await ctx.scan()
    expect(result.sourceRoot).toMatchInlineSnapshot(`"__DYNAMIC__/api"`)
  })
})
