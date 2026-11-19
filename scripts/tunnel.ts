// Starts ngrok to the Express server, on PUBLIC_BASE_URL's domain when one is set
// (e.g. a reserved/custom ngrok domain), so the URL stays the same across restarts.
import 'dotenv/config';
import { spawn } from 'node:child_process';

const port = process.env.PORT ?? '3001';
const url = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '');
const args = ['http', port, ...(url ? [`--url=${url}`] : [])];

console.log(`$ ngrok ${args.join(' ')}`);
const ngrok = spawn('ngrok', args, { stdio: 'inherit' });
ngrok.on('exit', (code) => process.exit(code ?? 0));
