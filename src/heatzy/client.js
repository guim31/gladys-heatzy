// -----------------------------------------------------------------------------
// Client of the Gizwits cloud the Heatzy app uses (https://euapi.gizwits.com).
//
//   POST /app/login                  { username, password, lang } → { token, uid, expire_at }
//   GET  /app/bindings?limit&skip    { devices: [{ did, dev_alias, product_key, is_online, … }] }
//   GET  /app/devdata/<did>/latest   { did, updated_at, attr: { mode, … } }
//   POST /app/control/<did>          { attrs: { … } } or { raw: [ … ] } → {}
//
// Every request carries the public Application Id of the Heatzy app (the one
// hass-heatzy and every open-source Heatzy client use) and, after the login,
// the user token. A refused token (expired, revoked by a login elsewhere) is
// renewed once. Errors carry a kind (ERROR_KINDS) and never the e-mail address,
// the password or the token.
// -----------------------------------------------------------------------------

import { httpRequest } from './http.js';

export const API_URL = 'https://euapi.gizwits.com';
export const APPLICATION_ID = 'c70a66ff039d41b4a220e198b0fcc8b3';

export const ERROR_KINDS = Object.freeze({
  AUTH: 'auth', // wrong e-mail or password
  UNREACHABLE: 'unreachable', // network, DNS, timeout, 5xx
  RATE_LIMITED: 'rate_limited',
  OFFLINE: 'offline', // the module is not connected to the cloud
  REFUSED: 'refused', // any other refusal of the API
});

// Gizwits error codes (error_code of a 4xx body).
const TOKEN_ERRORS = new Set([9004, 9006]); // token invalid, token expired
const LOGIN_ERRORS = new Set([9005, 9020]); // user not found, wrong username or password
const OFFLINE_ERRORS = new Set([9017, 9042]); // device offline, device not online
const RATE_ERRORS = new Set([9999]);

const BINDINGS_PAGE = 100;
const MAX_PAGES = 20;
// Renew the token this long before it expires.
const TOKEN_MARGIN_MS = 5 * 60_000;

export class HeatzyError extends Error {
  constructor(kind, message, { status = null, code = null } = {}) {
    super(message);
    this.name = 'HeatzyError';
    this.kind = kind;
    this.status = status;
    this.code = code;
  }
}

function errorFrom(status, body, what) {
  const code = Number(body?.error_code) || null;
  const detail = code ? `HTTP ${status}, Gizwits error ${code}` : `HTTP ${status}`;
  if (status === 429 || RATE_ERRORS.has(code)) {
    return new HeatzyError(ERROR_KINDS.RATE_LIMITED, `${what}: rate limited (${detail})`, {
      status,
      code,
    });
  }
  if (status >= 500) {
    return new HeatzyError(ERROR_KINDS.UNREACHABLE, `${what}: server error (${detail})`, {
      status,
      code,
    });
  }
  if (LOGIN_ERRORS.has(code)) {
    return new HeatzyError(ERROR_KINDS.AUTH, `${what}: wrong e-mail or password (${detail})`, {
      status,
      code,
    });
  }
  if (OFFLINE_ERRORS.has(code)) {
    return new HeatzyError(ERROR_KINDS.OFFLINE, `${what}: module offline (${detail})`, {
      status,
      code,
    });
  }
  return new HeatzyError(ERROR_KINDS.REFUSED, `${what}: refused (${detail})`, { status, code });
}

export class HeatzyClient {
  /**
   * @param {object} options
   * @param {string} options.email
   * @param {string} options.password
   * @param {Function} [options.request] HTTP seam (src/heatzy/http.js)
   * @param {() => number} [options.now]
   * @param {string} [options.baseUrl]
   */
  constructor({ email, password, request = httpRequest, now = () => Date.now(), baseUrl }) {
    this.email = email;
    this.password = password;
    this.request = request;
    this.now = now;
    this.baseUrl = baseUrl ?? API_URL;
    this.token = null;
    this.expiresAt = 0;
    this.loggingIn = null;
  }

  async send(method, path, { body, token, what }) {
    const headers = {
      Accept: 'application/json',
      'X-Gizwits-Application-Id': APPLICATION_ID,
    };
    if (token) {
      headers['X-Gizwits-User-Token'] = token;
    }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    let response;
    try {
      response = await this.request({
        method,
        url: `${this.baseUrl}/app/${path}`,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (err) {
      // The message of a network error never holds the body: safe to keep.
      throw new HeatzyError(ERROR_KINDS.UNREACHABLE, `${what}: ${err.message}`);
    }
    if (response.status >= 200 && response.status < 300) {
      return response.body ?? {};
    }
    throw errorFrom(response.status, response.body, what);
  }

  /** A valid token, logging in when there is none or it is about to expire. */
  async getToken({ force = false } = {}) {
    if (!force && this.token && this.now() < this.expiresAt - TOKEN_MARGIN_MS) {
      return this.token;
    }
    this.loggingIn ??= this.login().finally(() => {
      this.loggingIn = null;
    });
    return this.loggingIn;
  }

  async login() {
    if (!this.email || !this.password) {
      throw new HeatzyError(ERROR_KINDS.AUTH, 'Login: e-mail or password missing');
    }
    const answer = await this.send('POST', 'login', {
      body: { username: this.email, password: this.password, lang: 'en' },
      what: 'Login',
    });
    if (typeof answer.token !== 'string' || !answer.token) {
      throw new HeatzyError(ERROR_KINDS.REFUSED, 'Login: no token in the answer');
    }
    this.token = answer.token;
    // expire_at is in seconds; without it, keep the token one day.
    this.expiresAt =
      Number(answer.expire_at) > 0 ? Number(answer.expire_at) * 1000 : this.now() + 86_400_000;
    return this.token;
  }

  /** An authenticated request; a refused token is renewed once. */
  async call(method, path, what, body) {
    const token = await this.getToken();
    try {
      return await this.send(method, path, { body, token, what });
    } catch (err) {
      if (err.kind !== ERROR_KINDS.REFUSED || !(err.status === 401 || TOKEN_ERRORS.has(err.code))) {
        throw err;
      }
      // Another request may have renewed it meanwhile: log in only once.
      const renewed = this.token === token ? await this.getToken({ force: true }) : this.token;
      return this.send(method, path, { body, token: renewed, what });
    }
  }

  /** Every module of the account. */
  async getBindings() {
    const devices = [];
    for (let skip = 0, page = 0; page < MAX_PAGES; page += 1) {
      const answer = await this.call(
        'GET',
        `bindings?limit=${BINDINGS_PAGE}&skip=${skip}`,
        'Module list',
      );
      const list = Array.isArray(answer.devices) ? answer.devices : [];
      devices.push(...list.filter((device) => device && typeof device.did === 'string'));
      skip += list.length;
      // A short page ends the list, unless Gizwits capped the page size (its
      // default is 20): a page of a multiple of 20 asks for the next one.
      if (list.length === 0 || (list.length < BINDINGS_PAGE && list.length % 20 !== 0)) {
        break;
      }
    }
    return devices;
  }

  /** Latest attributes of a module. */
  async getAttributes(did) {
    const answer = await this.call(
      'GET',
      `devdata/${encodeURIComponent(did)}/latest`,
      'Module reading',
    );
    return answer.attr && typeof answer.attr === 'object' ? answer.attr : {};
  }

  async control(did, payload) {
    await this.call('POST', `control/${encodeURIComponent(did)}`, 'Command', payload);
  }
}
