import type { VariantObject } from '@unocss/core'
import type { AttributifyOptions } from './types'
import { isAttributifySelector } from '@unocss/core'

// eslint-disable-next-line regexp/no-super-linear-backtracking
export const variantsRE = /^(?!.*\[[^:]+:.+\]$)((?:.+:)?!?)(.*)$/

export function variantAttributify(options: AttributifyOptions = {}): VariantObject {
  const prefix = options.prefix ?? 'un-'
  const prefixedOnly = options.prefixedOnly ?? false
  const trueToNonValued = options.trueToNonValued ?? false
  let variantsValueRE: RegExp | false | undefined

  return {
    name: 'attributify',
    match(input, { generator }) {
      const match = isAttributifySelector(input)

      if (!match)
        return

      let name = match[1]
      if (name.startsWith(prefix))
        name = name.slice(prefix.length)
      else if (prefixedOnly)
        return

      const content = match[2]

      let [, variants = '', body = content] = content.match(variantsRE) || []

      // For special case like `<div border="~ red:10">`
      // `border-red:10` should not consider `border-red:` as a variant
      if (variants && body.match(/^[\d.]+$/)) {
        const variantParts = variants.split(/([^:]*:)/g).filter(Boolean)
        body = variantParts.pop() + body
        variants = variantParts.join('')
      }

      // Expend attributify self-referencing `~`
      if (body === '~' || (trueToNonValued && body === 'true') || !body)
        return `${variants}${name}`

      if (variantsValueRE == null) {
        const separators = generator?.config?.separators?.join('|')
        if (separators)
          variantsValueRE = new RegExp(`^(.*\\](?:${separators}))(\\[[^\\]]+?\\])$`)
        else
          variantsValueRE = false
      }

      if (variantsValueRE) {
        const [, bodyVariant, bracketValue] = content.match(variantsValueRE) || []
        if (bracketValue)
          return `${bodyVariant}${variants}${name}-${bracketValue}`
      }

      // if (body.match(/^[\d.]+$/))
      //   return `${variants}${name}:${body}`

      return `${variants}${name}-${body}`
    },
  }
}
