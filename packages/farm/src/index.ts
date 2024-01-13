import process from 'node:process'
import type { UserConfig, UserConfigDefaults } from '@unocss/core'
import type { ResolvedUnpluginOptions, UnpluginOptions } from 'unplugin-test'
import { createUnplugin } from 'unplugin-test'
import { createContext } from '../../shared-integration/src/context'
import { setupContentExtractor } from '../../shared-integration/src/content'
import { getHash } from '../../shared-integration/src/hash'
import { HASH_PLACEHOLDER_RE, LAYER_MARK_ALL, LAYER_PLACEHOLDER_RE, RESOLVED_ID_RE, getHashPlaceholder, getLayerPlaceholder, resolveId, resolveLayer } from '../../shared-integration/src/layers'
import { applyTransformers } from '../../shared-integration/src/transformers'
import { getPath, isCssId } from '../../shared-integration/src/utils'

export interface WebpackPluginOptions<Theme extends object = object> extends UserConfig<Theme> {
  /**
   * Manually enable watch mode
   *
   * @default false
   */
  watch?: boolean
}

const PLUGIN_NAME = 'unocss:farm'
const UPDATE_DEBOUNCE = 10

export function defineConfig<Theme extends object>(config: WebpackPluginOptions<Theme>) {
  return config
}

export default function FarmPlugin<Theme extends object>(
  configOrPath?: WebpackPluginOptions<Theme> | string,
  defaults?: UserConfigDefaults,
) {
  return createUnplugin(() => {
    const ctx = createContext<WebpackPluginOptions>(configOrPath as any, {
      envMode: process.env.NODE_ENV === 'development' ? 'dev' : 'build',
      ...defaults,
    })
    const { uno, tokens, filter, extract, onInvalidate, tasks, flushTasks } = ctx

    let timer: any
    onInvalidate(() => {
      clearTimeout(timer)
      timer = setTimeout(updateModules, UPDATE_DEBOUNCE)
    })

    const nonPreTransformers = ctx.uno.config.transformers?.filter(i => i.enforce !== 'pre')

    if (nonPreTransformers?.length) {
      console.warn(
        // eslint-disable-next-line prefer-template
        '[unocss] webpack integration only supports "pre" enforce transformers currently.'
        + 'the following transformers will be ignored\n'
        + nonPreTransformers.map(i => ` - ${i.name}`).join('\n'),
      )
    }

    // TODO: detect webpack's watch mode and enable watcher
    tasks.push(setupContentExtractor(ctx, typeof configOrPath === 'object' && configOrPath?.watch))

    const entries = new Set<string>()
    const hashes = new Map<string, string>()

    const plugin = {
      name: 'unocss:farm',
      enforce: 'pre',
      transformInclude(id) {
        return filter('', id) && !id.endsWith('.html') && !RESOLVED_ID_RE.test(id)
      },
      async transform(code, id) {
        const result = await applyTransformers(ctx, code, id, 'pre')
        if (isCssId(id))
          return result
        if (result == null)
          tasks.push(extract(code, id))
        else
          tasks.push(extract(result.code, id))
        return result
      },
      resolveId(id) {
        const entry = resolveId(id)
        if (entry === id)
          return
        if (entry) {
          let query = ''
          const queryIndex = id.indexOf('?')
          if (queryIndex >= 0)
            query = id.slice(queryIndex)
          entries.add(entry)
          // preserve the input query
          return entry + query
        }
      },
      loadInclude(id) {
        const layer = getLayer(id)
        return !!layer
      },
      // serve the placeholders in virtual module
      load(id) {
        const layer = getLayer(id)
        const hash = hashes.get(id)
        if (layer)
          return (hash ? getHashPlaceholder(hash) : '') + getLayerPlaceholder(layer)
      },
      farm: {
        renderResourcePot: {
          async executor(params) {
            await flushTasks()
            const result = await uno.generate(tokens, { minify: true })
            let code = params.content
            let replaced = false
            code = code.replace(HASH_PLACEHOLDER_RE, '')
            code = code.replace(LAYER_PLACEHOLDER_RE, (_, quote, layer) => {
              replaced = true
              const css = layer === LAYER_MARK_ALL
                ? result.getLayers(undefined, Array.from(entries)
                  .map(i => resolveLayer(i)).filter((i): i is string => !!i))
                : (result.getLayer(layer) || '')

              if (!quote)
                return css

              // the css is in a js file, escaping
              let escaped = JSON.stringify(css).slice(1, -1)
              // in `eval()`, escaping twice
              if (quote === '\\"')
                escaped = JSON.stringify(escaped).slice(1, -1)
              return quote + escaped
            })
            if (replaced) {
              return {
                content: code,
                sourcemap: '',
              }
            }
          },
        },
      },
      webpack(compiler) {
        // replace the placeholders
        compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
          compilation.hooks.optimizeAssets.tapPromise(PLUGIN_NAME, async () => {
            const files = Object.keys(compilation.assets)

            await flushTasks()
            const result = await uno.generate(tokens, { minify: true })

            for (const file of files) {
              // https://github.com/unocss/unocss/pull/1428
              if (file === '*')
                return

              let code = compilation.assets[file].source().toString()
              let replaced = false
              code = code.replace(HASH_PLACEHOLDER_RE, '')
              code = code.replace(LAYER_PLACEHOLDER_RE, (_, quote, layer) => {
                replaced = true
                const css = layer === LAYER_MARK_ALL
                  ? result.getLayers(undefined, Array.from(entries)
                    .map(i => resolveLayer(i)).filter((i): i is string => !!i))
                  : (result.getLayer(layer) || '')

                if (!quote)
                  return css

                // the css is in a js file, escaping
                let escaped = JSON.stringify(css).slice(1, -1)
                // in `eval()`, escaping twice
                if (quote === '\\"')
                  escaped = JSON.stringify(escaped).slice(1, -1)
                return quote + escaped
              })
              if (replaced)
                compilation.assets[file] = new WebpackSources.RawSource(code) as any
            }
          })
        })
      },
    } as UnpluginOptions as Required<ResolvedUnpluginOptions>

    let lastTokenSize = tokens.size
    async function updateModules() {
      if (!plugin.__vfsModules)
        return

      await flushTasks()
      const result = await uno.generate(tokens)
      if (lastTokenSize === tokens.size)
        return

      lastTokenSize = tokens.size
      Array.from(plugin.__vfsModules)
        .forEach((id) => {
          const path = decodeURIComponent(id.slice(plugin.__virtualModulePrefix.length))
          const layer = resolveLayer(path)
          if (!layer)
            return
          const code = layer === LAYER_MARK_ALL
            ? result.getLayers(undefined, Array.from(entries)
              .map(i => resolveLayer(i)).filter((i): i is string => !!i))
            : (result.getLayer(layer) || '')

          const hash = getHash(code)
          hashes.set(path, hash)
          plugin.__vfs.writeModule(id, code)
        })
    }

    return plugin
  }).farm()
}
function getLayer(id: string) {
  let layer = resolveLayer(getPath(id))
  if (!layer) {
    const entry = resolveId(id)
    if (entry)
      layer = resolveLayer(entry)
  }
  return layer
}
