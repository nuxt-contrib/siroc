import 'v8-compile-cache'

import cac from 'cac'
import consola from 'consola'

import { version } from '../package.json'

import { build, BuildCommandOptions } from './commands/build'
import { changelog } from './commands/changelog'
import { run as runFile } from './commands/run'

const cli = cac('siroc')

const run = async <A extends (...args: any[]) => Promise<void>>(
  action: A,
  ...args: Parameters<A>
) => {
  await action(...args).catch(err => {
    consola.error(err)
    process.exit(1)
  })
}

cli
  .command('build [...packages]', 'Bundle input files')
  .option('-w, --watch', 'Watch files in bundle and rebuild on changes', {
    default: false,
  })
  .option('--dev', 'Build development bundle (only CJS)', {
    default: false,
  })
  .example(bin => `  ${bin} build`)
  .example(bin => `  ${bin} build @siroc/cli -w`)
  .action((packages: string[], options: BuildCommandOptions) =>
    run(build, { ...options, packages })
  )

cli.command('changelog', 'Generate changelog').action(() => run(changelog))

cli
  .command('run <file> [...args]', 'Run Node script')
  .allowUnknownOptions()
  .option('-w, --workspaces', 'Run command in all yarn workspaces.')
  .example(bin => `  ${bin} src/test.ts`)
  .example(bin => `  ${bin} --workspaces ls`)
  .action((file, args, options) => run(runFile, { file, args, options }))

cli.version(version)
cli.help()

cli.parse()

process.on('unhandledRejection', err => {
  consola.error(err)
  process.exit(1)
})
