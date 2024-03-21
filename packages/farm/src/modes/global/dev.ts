// /* eslint-disable no-console */
// import process from 'node:process'
// import * as querystring from 'node:querystring'
// import type { Plugin, Update, ViteDevServer } from 'vite'
// import type { GenerateResult, UnocssPluginContext } from '@unocss/core'
// import { notNull } from '@unocss/core'

// // import MagicString from 'magic-string'
// import type { JsPlugin } from '@farmfe/core'

// // import type { VitePluginConfig } from '../../types'
// import { LAYER_MARK_ALL, getHash, getLayerPlaceholder, getPath, resolveId, resolveLayer } from '../../integration'

// const WARN_TIMEOUT = 20000
// // const WS_EVENT_PREFIX = 'unocss:hmr'
// const HASH_LENGTH = 6

// export function GlobalModeDevPlugin({ uno, tokens, getConfig, tasks, flushTasks, affectedModules, onInvalidate, extract, filter }: UnocssPluginContext): JsPlugin[] {
//   const servers: any[] = []
//   const entries = new Set<string>()
//   // const cssPostPlugins = new Map<string | undefined, Plugin | undefined>()
//   const cssPlugins = new Map<string | undefined, Plugin | undefined>()
//   let invalidateTimer: any
//   const lastServedHash = new Map<string, string>()
//   let lastServedTime = Date.now()
//   // let resolved = false
//   let resolvedWarnTimer: any
//   const vfsLayers = new Set<string>()
//   const layerImporterMap = new Map<string, string>()

//   async function applyCssTransform(css: string, id: string, dir: string | undefined, ctx: PluginContext) {
//     const {
//       postcss = true,
//     } = await getConfig()
//     if (!cssPlugins.get(dir) || !postcss)
//       return css
//     // @ts-expect-error without this context absolute assets will throw an error
//     const result = await cssPlugins.get(dir).transform.call(ctx, css, id)
//     if (!result)
//       return css
//     if (typeof result === 'string')
//       css = result
//     else if (result.code)
//       css = result.code
//     css = css.replace(/[\n\r]/g, '')
//     return css
//   }
//   async function generateCSS(layer: string) {
//     await flushTasks()
//     let result: GenerateResult
//     let tokensSize = tokens.size
//     do {
//       result = await uno.generate(tokens)
//       // to capture new tokens created during generation
//       if (tokensSize === tokens.size)
//         break
//       tokensSize = tokens.size
//     } while (true)

//     const css = layer === LAYER_MARK_ALL
//       ? result.getLayers(undefined, Array.from(entries)
//         .map(i => resolveLayer(i)).filter((i): i is string => !!i))
//       : result.getLayer(layer)
//     const hash = getHash(css || '', HASH_LENGTH)
//     lastServedHash.set(layer, hash)
//     lastServedTime = Date.now()
//     return { hash, css }
//   }

//   function invalidate(timer = 10, ids: Set<string> = entries) {
//     // for (const server of servers) {
//     //   for (const id of ids) {
//     //     const mod = server.moduleGraph.getModuleById(id)
//     //     if (!mod)
//     //       continue
//     //     server!.moduleGraph.invalidateModule(mod)
//     //   }
//     // }
//     clearTimeout(invalidateTimer)
//     invalidateTimer = setTimeout(() => {
//       lastServedHash.clear()
//       sendUpdate(ids)
//     }, timer)
//   }

//   function sendUpdate(ids: Set<string>) {
//     for (const server of servers) {
//       server.ws.send({
//         type: 'update',
//         updates: Array.from(ids)
//           .map((id) => {
//             // const mod = server.moduleGraph.getModuleById(id)
//             // if (!mod)
//             //   return null
//             return {
//               acceptedPath: id,
//               path: id,
//               timestamp: lastServedTime,
//               type: 'js-update',
//             } as Update
//           })
//           .filter(notNull),
//       })
//     }
//   }

//   function setWarnTimer() {
//     if (!resolved && !resolvedWarnTimer) {
//       resolvedWarnTimer = setTimeout(() => {
//         if (process.env.TEST || process.env.NODE_ENV === 'test')
//           return
//         if (!resolved) {
//           const msg = '[unocss] entry module not found, have you add `import \'uno.css\'` in your main entry?'
//           console.warn(msg)
//           servers.forEach(({ ws }) => ws.send({
//             type: 'error',
//             err: { message: msg, stack: '' },
//           }))
//         }
//       }, WARN_TIMEOUT)
//     }
//   }

//   function clearWarnTimer() {
//     if (resolvedWarnTimer) {
//       clearTimeout(resolvedWarnTimer)
//       resolvedWarnTimer = undefined
//     }
//   }

//   let lastTokenSize = 0
//   let lastResult: GenerateResult | undefined
//   async function generateAll() {
//     await flushTasks()
//     if (lastResult && lastTokenSize === tokens.size)
//       return lastResult
//     lastResult = await uno.generate(tokens, { minify: true })
//     lastTokenSize = tokens.size
//     return lastResult
//   }
//   let replaced = false

//   onInvalidate(() => {
//     invalidate(10, new Set([...entries, ...affectedModules]))
//   })

//   return [
//     {
//       name: 'unocss:global',
//       priority: 200,
//       async configureDevServer(_server) {
//         servers.push(_server)

//         // _server.ws.on(WS_EVENT_PREFIX, async ([layer]: string[]) => {
//         //   const preHash = lastServedHash.get(layer)
//         //   await generateCSS(layer)
//         //   if (lastServedHash.get(layer) !== preHash)
//         //     sendUpdate(entries)
//         // })
//       },
//       buildStart: {
//         // warm up for preflights
//         executor() {
//           vfsLayers.clear()
//           tasks.length = 0
//           lastTokenSize = 0
//           lastResult = undefined
//           // uno.generate([], { preflights: true })
//         },
//       },
//       // transformIndexHtml: {
//       //   order: 'pre',
//       //   handler(code, { filename }) {
//       //     setWarnTimer()
//       //     tasks.push(extract(code, filename))
//       //   },
//       //   // Compatibility with Legacy Vite
//       //   enforce: 'pre',
//       //   transform(code, { filename }) {
//       //     setWarnTimer()
//       //     tasks.push(extract(code, filename))
//       //   },
//       // },

//       resolve: {
//         filters: { sources: ['uno.css'], importers: ['.*'] },
//         executor(params) {
//           const id = params.source
//           const entry = resolveId(id)
//           if (entry) {
//             console.log(params);

//             const layer = resolveLayer(entry)
//             if (layer) {
//               vfsLayers.add(layer)
//               if (params.importer)
//                 layerImporterMap.set(params.importer, entry)
//             }
//             return {
//               resolvedPath: entry,
//               // query: customParseQueryString(entry!),
//               query: [],
//               sideEffects: false,
//               external: false,
//               meta: {},
//             }
//           }
//         },
//       },
//       load: {
//         filters: {
//           resolvedPaths: ['.*'],
//         },
//         async executor(params) {
//           // console.log(params.resolvedPath);

//           const layer = resolveLayer(getPath(params.resolvedPath))

//           if (!layer)
//             return null
//           // console.log(layer);
//           console.log(getLayerPlaceholder(layer));

//           // const { hash, css } = await generateCSS(layer)
//           return {
//             // add hash to the chunk of CSS that it will send back to client to check if there is new CSS generated
//             content: getLayerPlaceholder(layer),
//             moduleType: 'js',
//           }
//         },
//       },
//       transform: {
//         filters: { resolvedPaths: ['.*'], moduleTypes: ['.*'] },
//         async executor(params) {
//           if (filter(params.content, params.resolvedPath))
//             tasks.push(extract(params.content, params.resolvedPath))

//           return null
//         },
//       },
//       // resolveId(id) {
//       //   const entry = resolveId(id)
//       //   if (entry) {
//       //     resolved = true
//       //     clearWarnTimer()
//       //     entries.add(entry)
//       //     return entry
//       //   }
//       // },

//       // async load(id) {
//       // const layer = resolveLayer(getPath(id))
//       // if (!layer)
//       //   return null

//       // const { hash, css } = await generateCSS(layer)
//       // return {
//       //   // add hash to the chunk of CSS that it will send back to client to check if there is new CSS generated
//       //   code: `__uno_hash_${hash}{--:'';}${css}`,
//       //   map: { mappings: '' },
//       // }
//       // },
//       // finish() {
//       //   clearWarnTimer()
//       // },
//     },
//     //     {
//     //       name: 'unocss:global:post',
//     //       apply(config, env) {
//     //         return env.command === 'serve' && !config.build?.ssr
//     //       },
//     //       enforce: 'post',
//     //       async transform(code, id) {
//     //         const layer = resolveLayer(getPath(id))

//     //         // inject css modules to send callback on css load
//     //         if (layer && code.includes('import.meta.hot')) {
//     //           let hmr = `
//     // try {
//     //   let hash = __vite__css.match(/__uno_hash_(\\w{${HASH_LENGTH}})/)
//     //   hash = hash && hash[1]
//     //   if (!hash)
//     //     console.warn('[unocss-hmr]', 'failed to get unocss hash, hmr might not work')
//     //   else
//     //     await import.meta.hot.send('${WS_EVENT_PREFIX}', ['${layer}']);
//     // } catch (e) {
//     //   console.warn('[unocss-hmr]', e)
//     // }
//     // if (!import.meta.url.includes('?'))
//     //   await new Promise(resolve => setTimeout(resolve, 100))`

//     //           const config = await getConfig() as VitePluginConfig

//     //           if (config.hmrTopLevelAwait === false)
//     //             hmr = `;(async function() {${hmr}\n})()`
//     //           hmr = `\nif (import.meta.hot) {${hmr}}`

//     //           const s = new MagicString(code)
//     //           s.append(hmr)

//     //           return {
//     //             code: s.toString(),
//     //             map: s.generateMap() as any,
//     //           }
//     //         }
//     //       },
//     //     },
//   ]
// }

// export function customParseQueryString(url: string | null) {
//   if (!url)
//     return []

//   const queryString = url.split('?')[1]

//   const parsedParams = querystring.parse(queryString)
//   const paramsArray = []

//   for (const key in parsedParams)
//     paramsArray.push([key, parsedParams[key]])

//   return paramsArray
// }
