import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const isProduction = mode === 'production';
  
  return {
    plugins: [react(), wasm(), topLevelAwait()],
    
    // Development server configuration
    server: {
      port: 8080,
      host: true, // Listen on all addresses
      strictPort: true,
      watch: {
        usePolling: true,
        interval: 100
      },
      proxy: {
        "/api": {
          target: "http://0.0.0.0:3000",
          changeOrigin: true,
          secure: false
        },
        "/api/ws": {
          target: "ws://0.0.0.0:3000",
          ws: true,
          changeOrigin: true,
          rewriteWsOrigin: true,
        }
      }
    },

    // Build configuration
    build: {
      outDir: "../static",
      emptyOutDir: true,
      sourcemap: !isProduction,
      minify: isProduction,
      target: 'esnext',
      rollupOptions: {
        output: {
          manualChunks: isProduction ? {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'mui-vendor': ['@mui/material', '@mui/x-data-grid']
          } : undefined
        }
      },
      // Production optimizations
      ...(isProduction && {
        chunkSizeWarningLimit: 1000,
        cssCodeSplit: true,
        reportCompressedSize: true,
        cssMinify: true,
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: true
          }
        }
      })
    },

    // Environment-specific settings
    define: {
      __DEV__: !isProduction,
      'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development')
    },

    // Optimization settings
    optimizeDeps: {
      include: [
        'react', 
        'react-dom', 
        'react-router-dom', 
        '@mui/material', 
        '@mui/x-data-grid',
        '@emotion/react',
        '@emotion/styled',
        '@mui/styled-engine'
      ],
      exclude: ['wam-message-gatling-wasm']
    },

    // WASM configuration
    worker: {
      format: 'es'
    },

    // Development-specific settings
    ...(mode === 'development' && {
      css: {
        devSourcemap: true
      },
      clearScreen: false,
      hmr: {
        overlay: true,
        host: '0.0.0.0',
        port: 5173,
        clientPort: 5173
      },
      // Enable more detailed logs in dev mode
      logLevel: 'info'
    })
  };
});
