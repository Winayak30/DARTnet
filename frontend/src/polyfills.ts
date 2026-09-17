// Must be the first import in main.tsx
// Polyfills Node globals that sockjs-client expects in the browser
(window as any).global = window;
(window as any).process = { env: {} };
