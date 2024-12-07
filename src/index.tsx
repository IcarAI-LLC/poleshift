// src/renderer/index.tsx

import { createRoot } from 'react-dom/client';
import App from './App';
import {setupPowerSync} from "./lib/powersync/db.ts";
try {
    setupPowerSync();
    // Continue with app initialization
} catch (error) {
    console.error('PowerSync setup failed:', error);
}
const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);
root.render(<App />);
