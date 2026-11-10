/**
 * Starts the local stand-in for Supabase, for trying the dashboard on your own
 * computer without creating a Supabase project.
 *
 *   1. In this folder:           npm install && npm run serve
 *   2. In the project folder:    copy the two lines it prints into a file named .env.local
 *   3. In the project folder:    npm run dev   and open http://127.0.0.1:5173/admin
 *
 * Everything lives in memory and disappears when you stop it.
 */
import { startEmulator } from './emulator.mjs';

const port = Number(process.env.PORT || 54321);
const email = process.env.ADMIN_EMAIL || 'admin@example.com';
const password = process.env.ADMIN_PASSWORD || 'wedding-test-2026';

const emulator = await startEmulator({ port, quiet: process.env.QUIET === '1' });
await emulator.createAdmin(email, password);

console.log(`
Local test backend is running at ${emulator.url}

Put these two lines in a file named .env.local in the project folder:

VITE_SUPABASE_URL=${emulator.url}
VITE_SUPABASE_PUBLISHABLE_KEY=${emulator.anonKey}

Dashboard sign-in for this test backend:
  email:    ${email}
  password: ${password}

Press Ctrl+C to stop. Nothing is kept after it stops.
`);
