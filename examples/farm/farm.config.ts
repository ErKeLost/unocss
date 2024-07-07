import { defineConfig } from '@farmfe/core'
import vue from '@vitejs/plugin-vue'
import UnoCSS from '@unocss/farm'

export default defineConfig({
  compilation: {
    persistentCache:false,
  },
  vitePlugins: [vue()],
  plugins: [UnoCSS()],
})
