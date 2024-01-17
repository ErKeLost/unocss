// import process from 'node:process'
// import type { UserConfig, UserConfigDefaults } from '@unocss/core'
// import { notNull } from '@unocss/core'
// import type { ResolvedUnpluginOptions, UnpluginOptions } from 'unplugin-test'
// import { createUnplugin } from 'unplugin-test'
// import { createContext } from '../../shared-integration/src/context'
// import { setupContentExtractor } from '../../shared-integration/src/content'
// import { getHash } from '../../shared-integration/src/hash'
// import { HASH_PLACEHOLDER_RE, LAYER_MARK_ALL, LAYER_PLACEHOLDER_RE, RESOLVED_ID_RE, getHashPlaceholder, getLayerPlaceholder, resolveId, resolveLayer } from '../../shared-integration/src/layers'
// import { applyTransformers } from '../../shared-integration/src/transformers'
// import { getPath, isCssId } from '../../shared-integration/src/utils'
// export interface FarmPluginOptions<Theme extends object = object> extends UserConfig<Theme> {
//   /**
//    * Manually enable watch mode
//    *
//    * @default false
//    */
//   watch?: boolean
// }

// const PLUGIN_NAME = 'unocss:farm'
// const UPDATE_DEBOUNCE = 10
// const WARN_TIMEOUT = 20000
// const WS_EVENT_PREFIX = 'unocss:hmr'
// const HASH_LENGTH = 6

// export function defineConfig<Theme extends object>(config: FarmPluginOptions<Theme>) {
//   return config
// }

// export default function FarmPlugin<Theme extends object>(
//   configOrPath?: FarmPluginOptions<Theme> | string,
//   defaults?: UserConfigDefaults,
// ) {
//   return createUnplugin(() => {
//     const ctx = createContext<FarmPluginOptions>(configOrPath as any, {
//       envMode: process.env.NODE_ENV === 'development' ? 'dev' : 'build',
//       ...defaults,
//     })
//     const { uno, tokens, filter, extract, affectedModules, onInvalidate, tasks, flushTasks } = ctx
//     const servers: any[] = []
//     const entries = new Set<string>()
//     let invalidateTimer: any
//     const lastServedHash = new Map<string, string>()
//     let lastServedTime = Date.now()
//     const resolved = false
//     let resolvedWarnTimer: any
//     async function generateCSS(layer: string) {
//       await flushTasks()
//       let result: any
//       let tokensSize = tokens.size
//       do {
//         result = await uno.generate(tokens)
//         // to capture new tokens created during generation
//         if (tokensSize === tokens.size)
//           break
//         tokensSize = tokens.size
//       } while (true)

//       const css = layer === LAYER_MARK_ALL
//         ? result.getLayers(undefined, Array.from(entries)
//           .map(i => resolveLayer(i)).filter((i): i is string => !!i))
//         : result.getLayer(layer)
//       const hash = getHash(css || '', HASH_LENGTH)
//       lastServedHash.set(layer, hash)
//       lastServedTime = Date.now()
//       return { hash, css }
//     }
//     let timer: any

//     function invalidate(timer = 10, ids: Set<string> = entries) {
//       for (const server of servers) {
//         // for (const id of ids)

//         // const mod = server.viteModuleGraph.getModuleById(id)
//         // if (!mod)
//         //   continue
//         // server!.moduleGraph.invalidateModule(mod)
//       }
//       clearTimeout(invalidateTimer)
//       invalidateTimer = setTimeout(() => {
//         lastServedHash.clear()
//         sendUpdate(ids)
//       }, timer)
//     }

//     function sendUpdate(ids: Set<string>) {
//       for (const server of servers) {
//         server.ws.send({
//           type: 'update',
//           updates: Array.from(ids)
//             .map((id) => {
//               console.log({
//                 acceptedPath: resolveId(id),
//                 path: resolveId(id),
//                 timestamp: lastServedTime,
//                 type: 'js-update',
//               })
//               // const mod = server.moduleGraph.getModuleById(id)
//               // if (!mod)
//               // return null
//               return {
//                 acceptedPath: resolveId(id),
//                 path: resolveId(id),
//                 timestamp: lastServedTime,
//                 type: 'js-update',
//               }
//             })
//             .filter(notNull),
//         })
//       }
//     }

//     onInvalidate(() => {
//       invalidate(10, new Set([...entries, ...affectedModules]))
//     })

//     const nonPreTransformers = ctx.uno.config.transformers?.filter(i => i.enforce !== 'pre')

//     if (nonPreTransformers?.length) {
//       console.warn(
//         // eslint-disable-next-line prefer-template
//         '[unocss] webpack integration only supports "pre" enforce transformers currently.'
//         + 'the following transformers will be ignored\n'
//         + nonPreTransformers.map(i => ` - ${i.name}`).join('\n'),
//       )
//     }

//     // TODO: detect webpack's watch mode and enable watcher
//     tasks.push(setupContentExtractor(ctx, typeof configOrPath === 'object' && configOrPath?.watch))

//     const hashes = new Map<string, string>()

//     const plugin = {
//       name: 'unocss:farm',
//       enforce: 'pre',
//       transformInclude(id) {
//         return filter('', id) && !id.endsWith('.html') && !RESOLVED_ID_RE.test(id)
//       },
//       async transform(code, id) {
//         const result = await applyTransformers(ctx, code, id, 'pre')
//         if (isCssId(id))
//           return result
//         if (result == null)
//           tasks.push(extract(code, id))
//         else
//           tasks.push(extract(result.code, id))
//         return result
//       },
//       resolveId(id) {
//         // const entry = resolveId(id)

//         // if (entry === id)
//         //   return
//         // if (entry) {
//         //   let query = ''
//         //   const queryIndex = id.indexOf('?')
//         //   if (queryIndex >= 0)
//         //     query = id.slice(queryIndex)
//         //   entries.add(entry)
//         //   console.log('resolveId', entry, id);

//         //   return entry + query
//         // }
//         const entry = resolveId(id)
//         if (entry) {
//           entries.add(entry)
//           console.log(entry);

//           return entry
//         }
//       },
//       loadInclude(id) {
//         const layer = getLayer(id)
//         return !!layer
//       },
//       // serve the placeholders in virtual module
//       load(id) {
//         const layer = getLayer(id)
//         const hash = hashes.get(id)
//         if (layer)
//           return (hash ? getHashPlaceholder(hash) : '') + getLayerPlaceholder(layer)
//       },
//       farm: {
//         async configureDevServer(_server) {
//           servers.push(_server)
//           // _server.ws.on(WS_EVENT_PREFIX, async ([layer]: string[]) => {
//           //   const preHash = lastServedHash.get(layer)
//           //   await generateCSS(layer)
//           //   if (lastServedHash.get(layer) !== preHash)
//           //     sendUpdate(entries)
//           // })
//         },
//         // updateModules: {
//         //   async executor(params) {
//         //     // await flushTasks()
//         //     // invalidate()
//         //     // console.log(params)
//         //   },
//         // },
//         renderResourcePot: {
//           async executor(params: any) {
//             await flushTasks()
//             const result = await uno.generate(tokens, { minify: true })
//             let code = params.content
//             let replaced = false
//             code = code.replace(HASH_PLACEHOLDER_RE, '')
//             code = code.replace(LAYER_PLACEHOLDER_RE, (_, quote, layer) => {
//               replaced = true
//               const css = layer === LAYER_MARK_ALL
//                 ? result.getLayers(undefined, Array.from(entries)
//                   .map(i => resolveLayer(i)).filter((i): i is string => !!i))
//                 : (result.getLayer(layer) || '')

//               if (!quote)
//                 return css

//               // the css is in a js file, escaping
//               let escaped = JSON.stringify(css).slice(1, -1)
//               // in `eval()`, escaping twice
//               if (quote === '\\"')
//                 escaped = JSON.stringify(escaped).slice(1, -1)
//               return quote + escaped
//             })
//             if (replaced) {
//               return {
//                 content: code,
//                 sourcemap: '',
//               }
//             }
//           },
//         },
//       },
//     } as UnpluginOptions as Required<ResolvedUnpluginOptions>

//     return plugin
//   }).farm()
// }
// function getLayer(id: string) {
//   let layer = resolveLayer(getPath(id))
//   if (!layer) {
//     const entry = resolveId(id)
//     if (entry)
//       layer = resolveLayer(entry)
//   }
//   return layer
// }
