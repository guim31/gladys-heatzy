// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Refresh intervals offered in the configuration, in seconds. One minute at
// least: the Gizwits cloud is shared by every Heatzy user and has quotas.
export const POLL_INTERVALS = ['60', '120', '300', '600'];

export const DEFAULT_CONFIG = {
  email: '',
  password: '',
  poll_interval: '120',
  language: 'fr',
};

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const interval =
    source.poll_interval === undefined || source.poll_interval === null
      ? ''
      : String(source.poll_interval);
  return {
    email: typeof source.email === 'string' ? source.email.trim() : '',
    // Kept as typed: spaces may be part of a password.
    password: typeof source.password === 'string' ? source.password : '',
    pollIntervalMs:
      Number(POLL_INTERVALS.includes(interval) ? interval : DEFAULT_CONFIG.poll_interval) * 1000,
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
  };
}
