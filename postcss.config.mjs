// PostCSS config — written in ESM so Vite (which loads its config files
// via the native ESM loader) doesn't print 'The CJS build of Vite's Node
// API is deprecated' on every dev start.
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
