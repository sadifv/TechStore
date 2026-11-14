const defaults = [
  ['setup', 'Arma tu setup', 'all'],
  ['study', 'Estudia desde casa', 'all'],
  ['gaming', 'Juega y transmite', 'all'],
  ['halloween', 'Ilumina tu setup', 'halloween'],
  ['christmas', 'Regalos para gamers', 'christmas'],
].map(([key, title, theme], order) => ({ key, title, theme, order, enabled: true }));

const validKey = (key) =>
  typeof key === 'string' &&
  /^[a-z][a-z0-9-]{1,39}$/.test(key) &&
  !['constructor', 'prototype'].includes(key);

function normalizeDefinition(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !validKey(body.key)) return null;
  if (body.remove === true) {
    return Object.keys(body).every((key) => ['key', 'remove'].includes(key))
      ? { key: body.key, remove: true }
      : null;
  }
  if (
    Object.keys(body).some((key) => !['key', 'title', 'theme', 'order', 'enabled'].includes(key)) ||
    typeof body.title !== 'string' ||
    !body.title.trim() ||
    body.title.trim().length > 80 ||
    /[<>\x00-\x1f\x7f]/.test(body.title) ||
    !['all', 'normal', 'halloween', 'christmas'].includes(body.theme) ||
    !Number.isInteger(body.order) ||
    body.order < 0 ||
    body.order > 100 ||
    typeof body.enabled !== 'boolean'
  )
    return null;
  return {
    key: body.key,
    title: body.title.trim(),
    theme: body.theme,
    order: body.order,
    enabled: body.enabled,
    removed: false,
  };
}

function mergeDefinitions(records = []) {
  const definitions = new Map(defaults.map((entry) => [entry.key, entry]));
  for (const record of records) {
    const key = record._id || record.key;
    if (!validKey(key)) continue;
    if (record.removed) definitions.delete(key);
    else
      definitions.set(key, {
        key,
        title: record.title,
        theme: record.theme,
        order: record.order,
        enabled: record.enabled,
      });
  }
  return [...definitions.values()].sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
}

module.exports = { defaults, validKey, normalizeDefinition, mergeDefinitions };
