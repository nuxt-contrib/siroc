import 'v8-compile-cache'
import { PerformanceObserver, performance } from 'perf_hooks'

import { Package } from '../core'
import cac from 'cac'
import { bold } from 'chalk'
import consola from 'consola'

import { version } from '../../package.json'

import { build, BuildCommandOptions } from './commands/build'
import { dev, DevCommandOptions } from './commands/dev'
import { run as runFile } from './commands/run'

import { time, timeEnd, RemoveFirst } from './utils'

let wasErrored = false
const error = consola.error.bind(consola)
consola.error = (message: any, ...args: any[]) => {
  wasErrored = true
  error(message, ...args)
}

time('load root package')
let rootPackage: Package
try {
  rootPackage = new Package()
} catch (e) {
  throw new Error(`Couldn't load package: ${e}`)
}
timeEnd('load root package')

const exampleProject = rootPackage.pkg.name || '@siroc/cli'

const obs = new PerformanceObserver(items => {
  const { duration, name } = items.getEntries()[0]
  const seconds = (duration / 1000).toFixed(1)
  const time = duration > 1000 ? seconds + 's' : Math.round(duration) + 'ms'
  rootPackage.logger.success(`${name} in ${bold(time)}`)
})
obs.observe({ entryTypes: ['measure'] })

time('load CLI')
const cli = cac('siroc')

const run = async <
  A extends (pkg: Package, ...args: any[]) => void | Promise<void>
>(
  type: string,
  action: A,
  ...args: RemoveFirst<Parameters<A>>
) => {
  performance.mark(`Start ${type}`)
  await Promise.resolve(action(rootPackage, ...args)).catch(err => {
    rootPackage.logger.error(err)
    process.exit(1)
  })
  performance.mark(`Stop ${type}`)
  performance.measure(`Finished ${type}`, `Start ${type}`, `Stop ${type}`)
}

cli
  .command('build [...packages]', 'Bundle input files')
  .option('-w, --watch', 'Watch files in bundle and rebuild on changes', {
    default: false,
  })
  .option('--dev', 'Build development bundle (only CJS)', {
    default: false,
  })
  .option('-i <input>', 'Specify input file name')
  .option('-o <output>', 'Specify output file name')
  .option('-f <format>', 'Specify output file format')
  .example(bin => `  ${bin} build`)
  .example(bin => `  ${bin} build ${exampleProject} -w`)
  .action((packages: string[], options: BuildCommandOptions) =>
    run('building', build, { ...options, packages })
  )

cli
  .command('[...packages]', 'Bundle input files')
  .option('-w, --watch', 'Watch files in bundle and rebuild on changes', {
    default: false,
  })
  .option('--dev', 'Build development bundle (only CJS)', {
    default: false,
  })
  .option('-i <input>', 'Specify input file name')
  .option('-o <output>', 'Specify output file name')
  .option('-f <format>', 'Specify output file format')
  .example(bin => `  ${bin} build`)
  .example(bin => `  ${bin} build ${exampleProject} -w`)
  .action((packages: string[], options: BuildCommandOptions) =>
    run('building', build, { ...options, packages })
  )

cli
  .command('dev [...packages]', 'Generate package stubs for quick development')
  .example(bin => `  ${bin} dev`)
  .example(bin => `  ${bin} dev ${exampleProject} -w`)
  .action((packages: string[], options: DevCommandOptions) =>
    run('stubbing', dev, { ...options, packages })
  )

cli
  .command('run <file> [...args]', 'Run Node script')
  .allowUnknownOptions()
  .option('-w, --workspaces', 'Run command in all yarn workspaces.')
  .option('-s, --sequential', 'Run sequentially rather than in paralle.')
  .example(bin => `  ${bin} src/test.ts`)
  .example(bin => `  ${bin} --workspaces ls`)
  .action((file, args, options) =>
    run('running', runFile, { file, args, options })
  )

Object.entries(rootPackage.options.commands).forEach(([command, action]) => {
  cli
    .command(`${command}`, `Custom command (${bold(rootPackage.pkg.name)})`)
    .action(() => run(command, action))
})

cli.version(version)
cli.help()
timeEnd('load CLI')

cli.parse()

process.on('beforeExit', () => {
  if (wasErrored) process.exit(1)
})

process.on('unhandledRejection', err => {
  consola.error(err)
  process.exit(1)
})
