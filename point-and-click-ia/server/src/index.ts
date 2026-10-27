/** Point d'entrée du serveur. `npm run dev` (tsx watch) ou `npm start` après build. */
import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildApp } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const here = dirname(fileURLToPath(import.meta.url));
const app = await buildApp({ config, logger: true, staticDir: resolve(here, '../../client/dist') });

try {
  await app.listen({ port: config.port, host: config.host });
  app.log.info(`Fournisseurs : texte=${config.textProvider}, image=${config.imageProvider}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
