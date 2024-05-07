import process from 'node:process'
import type { UserConfig, UserConfigDefaults } from '@unocss/core'
import type { ResolvedUnpluginOptions, UnpluginOptions } from 'unplugin'
import { createUnplugin } from 'unplugin'
import { createContext } from '../../shared-integration/src/context'
import { setupContentExtractor } from '../../shared-integration/src/content'
import { getHash } from '../../shared-integration/src/hash'
import { HASH_PLACEHOLDER_RE, LAYER_MARK_ALL, LAYER_PLACEHOLDER_RE, RESOLVED_ID_RE, getCssEscaperForJsContent, getHashPlaceholder, getLayerPlaceholder, resolveId, resolveLayer } from '../../shared-integration/src/layers'
import { applyTransformers } from '../../shared-integration/src/transformers'
import { getPath, isCssId } from '../../shared-integration/src/utils'
import MagicString from 'magic-string'

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
      // timer = setTimeout(updateModules, UPDATE_DEBOUNCE)
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
      name: PLUGIN_NAME,
      enforce: 'pre',
      transformInclude(id: string) {
        return filter('', id) && !id.endsWith('.html') && !RESOLVED_ID_RE.test(id)
      },
      async transform(code: string, id: string) {
        const result = await applyTransformers(ctx, code, id, 'pre')
        if (isCssId(id))
          return result
        if (result == null)
          tasks.push(extract(code, id))

        else
          tasks.push(extract(result.code, id))
        return result
      },
      resolveId(id: string) {
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
      loadInclude(id: string) {
        const layer = getLayer(id)
        return !!layer
      },
      // serve the placeholders in virtual module
      load(id: string) {

        const layer = getLayer(id)
        const hash = hashes.get(id)
        if (layer)
          return (hash ? getHashPlaceholder(hash) : '') + getLayerPlaceholder(layer)
      },
      farm: {
        renderResourcePot: {
          filters: {
            moduleIds: [''],
          },
          async executor(params: { content: any }) {
            await flushTasks()
            const result = await uno.generate(tokens, { minify: true })

            let code = params.content
            let replaced = false
            let escapeCss: ReturnType<typeof getCssEscaperForJsContent>
            code = code.replace(HASH_PLACEHOLDER_RE, '')
            code = code.replace(LAYER_PLACEHOLDER_RE, (_: any, layer: string | undefined, escapeView: string) => {
              replaced = true
              const css = layer === LAYER_MARK_ALL
                ? result.getLayers(undefined, Array.from(entries)
                  .map(i => resolveLayer(i)).filter((i): i is string => !!i))
                : (result.getLayer(layer) || '')

              escapeCss = escapeCss ?? getCssEscaperForJsContent(escapeView)

              return escapeCss(css)
            })
            if (replaced) {
              const s = new MagicString(code)
              return {
                content: s.toString(),
                sourcemap: s.generateMap() as any,
              }
            }
          },
        },
      },
    } as unknown as UnpluginOptions as Required<ResolvedUnpluginOptions>

    // let lastTokenSize = tokens.size
    // webpack 的 update
    // async function updateModules() {
    //   if (!plugin.__vfsModules)
    //     return

    //   await flushTasks()
    //   const result = await uno.generate(tokens)
    //   if (lastTokenSize === tokens.size)
    //     return

    //   lastTokenSize = tokens.size
    //   Array.from(plugin.__vfsModules)
    //     .forEach((id) => {
    //       const path = decodeURIComponent(id.slice(plugin.__virtualModulePrefix.length))
    //       const layer = resolveLayer(path)
    //       if (!layer)
    //         return
    //       const code = layer === LAYER_MARK_ALL
    //         ? result.getLayers(undefined, Array.from(entries)
    //           .map(i => resolveLayer(i)).filter((i): i is string => !!i))
    //         : (result.getLayer(layer) || '')

    //       const hash = getHash(code)
    //       hashes.set(path, hash)
    //       plugin.__vfs.writeModule(id, code)
    //     })
    // }

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
