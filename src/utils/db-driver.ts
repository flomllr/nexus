import { stripIndent } from 'common-tags'
import * as Config from '../framework/config'
import * as Layout from '../framework/layout'
import * as Plugin from '../framework/plugin'
import { fatal } from './process'

export async function validateAndLoadDBDriver(
  config: Config.LoadedConfig
): Promise<Plugin.WorkflowHooks> {
  const layout = await Layout.create()
  const plugins = await Plugin.loadAllWorkflowPluginsFromPackageJson(
    layout,
    config
  )
  const dbDrivers = plugins.filter(p => p.hooks.db !== undefined)

  if (dbDrivers.length === 0) {
    fatal(
      stripIndent`
        You have no database driver installed. Official drivers: "pumpkins-plugin-prisma".
        Run ${layout.packageManager.renderAddDeps([
          '<db-driver>',
        ])} to install one.
      `
    )
  }

  if (dbDrivers.length > 1) {
    fatal(
      `You have several database drivers installed: ${plugins
        .map(p => `"${p.name}"`)
        .join(', ')}\n You can use only one at a time.`
    )
  }

  return dbDrivers[0].hooks
}