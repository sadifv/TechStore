import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

export function configureProxy(redirects, backendUrl) {
  if (!backendUrl) return redirects;
  let target;
  try {
    target = new URL(backendUrl);
  } catch {
    throw new Error('NETLIFY_BACKEND_URL debe ser un origen HTTPS válido.');
  }
  if (
    target.protocol !== 'https:' ||
    target.username ||
    target.password ||
    target.pathname !== '/' ||
    target.search ||
    target.hash
  ) {
    throw new Error('NETLIFY_BACKEND_URL debe ser un origen HTTPS sin credenciales ni ruta.');
  }

  let replacements = 0;
  const result = redirects.replace(
    /^(\/(api|uploads)\/\*)[ \t]+https:\/\/\S+[ \t]+200![ \t]*\r?$/gm,
    (_line, source, prefix) => {
      replacements += 1;
      return `${source} ${target.origin}/${prefix}/:splat 200!`;
    },
  );
  if (replacements !== 2) throw new Error('Faltan las dos reglas de proxy esperadas.');
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = new URL('../dist/_redirects', import.meta.url);
  const redirects = await readFile(file, 'utf8');
  await writeFile(file, configureProxy(redirects, process.env.NETLIFY_BACKEND_URL));
}
