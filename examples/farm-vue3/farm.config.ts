import { resolve } from 'node:path'
import { defineConfig } from '@farmfe/core'
import vue from '@vitejs/plugin-vue'
import UnoCSS from '@unocss/farm'
import presetAttributify from '@unocss/preset-attributify'
import presetIcons from '@unocss/preset-icons'
import presetUno from '@unocss/preset-uno'
import { FileSystemIconLoader } from '@iconify/utils/lib/loader/node-loaders'

// eslint-disable-next-line node/prefer-global/process
const iconDirectory = resolve(process.cwd(), 'icons')

export default defineConfig({
  vitePlugins: [
    vue(),
  ],
  plugins: [
    // UnoCSS()
    UnoCSS({
      shortcuts: [
        { logo: 'i-logos-vue w-6em h-6em transform transition-800' },
      ],
      presets: [
        presetUno(),
        presetAttributify(),
        presetIcons({
          extraProperties: {
            'display': 'inline-block',
            'vertical-align': 'middle',
          },
          collections: {
            custom: FileSystemIconLoader(iconDirectory),
          },
        }),
      ],
    }),
  ],
})
