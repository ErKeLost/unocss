import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    'src/index',
  ],
  clean: true,
  // declaration: true,
  failOnWarn: false,
  externals: [
    'vite',
    'webpack',
  ],
  rollup: {
    emitCJS: true,
  },
})
