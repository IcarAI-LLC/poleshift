/// <reference types="vite/client" />
// vite-env.d.ts
declare module '*?worker' {
    const workerConstructor: {
        new (): Worker
    }
    export default workerConstructor
}
