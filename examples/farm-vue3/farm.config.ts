import { defineConfig } from '@farmfe/core'
import UnoCSS from '@unocss/farm'
import Vue from '@vitejs/plugin-vue'

export default defineConfig({
  vitePlugins: [
    Vue(),
  ],
  compilation: {
    persistentCache: false,
    progress: false,
  },
  plugins: [
    UnoCSS(),
  ],
})
