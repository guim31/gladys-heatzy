// -----------------------------------------------------------------------------
// A simulated Gizwits cloud, as the Heatzy app sees it: login, module list,
// latest attributes, commands. The modules are the real devices of the
// hass-heatzy test fixtures (test/fixtures/heatzy, anonymized), and a command
// changes their attributes the way the module does (the Pilote v1 raw frame
// included), so a reading after a command shows what the module did.
// Gizwits errors are answered with their real HTTP status and error_code.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

export const EMAIL = 'user@example.com';
export const PASSWORD = 'correct horse battery staple';
export const APPLICATION_ID = 'c70a66ff039d41b4a220e198b0fcc8b3';

export const FIXTURES = [
  'pilote-v1',
  'pilote-v2',
  'pilote-v3',
  'pilote-v4',
  'pilote-pro',
  'glow',
  'onyx',
  'bloom',
];

export function loadFixture(name) {
  return JSON.parse(
    readFileSync(new URL(`../fixtures/heatzy/${name}.json`, import.meta.url), 'utf8'),
  );
}

const V1_MODES = ['舒适', '经济', '解冻', '停止'];

export class FakeGizwits {
  /**
   * @param {object} [options]
   * @param {string[]} [options.modules] fixture names
   * @param {() => number} [options.now]
   */
  constructor({ modules = FIXTURES, now = () => Date.now() } = {}) {
    this.now = now;
    this.devices = new Map();
    for (const name of modules) {
      const { binding, latest } = loadFixture(name);
      this.devices.set(binding.did, { binding: { ...binding }, attr: { ...latest.attr } });
    }
    this.password = PASSWORD;
    this.tokens = new Map(); // token → expire_at (s)
    this.tokenLifetimeS = 7 * 86_400;
    this.counter = 0;
    this.requests = [];
    this.logins = 0;
    /** Next answers to force, in order: { status, body } or 'network'. */
    this.failures = [];
  }

  /** The did of a fixture module. */
  did(name) {
    return loadFixture(name).binding.did;
  }

  attr(name) {
    return this.devices.get(this.did(name)).attr;
  }

  setOnline(name, online) {
    this.devices.get(this.did(name)).binding.is_online = online;
  }

  /** Invalidate every token, as a login from another app does. */
  revokeTokens() {
    this.tokens.clear();
  }

  /** The request seam of src/heatzy/client.js. */
  request = async ({ method, url, headers = {}, body }) => {
    const { pathname, searchParams } = new URL(url);
    const parsed = body ? JSON.parse(body) : undefined;
    this.requests.push({
      method,
      path: pathname,
      query: searchParams.toString(),
      body: parsed,
      headers,
    });
    const forced = this.failures.shift();
    if (forced === 'network') {
      throw new Error('fetch failed');
    }
    if (forced) {
      return forced;
    }
    if (headers['X-Gizwits-Application-Id'] !== APPLICATION_ID) {
      return { status: 400, body: { error_code: 9001, error_message: 'appid invalid' } };
    }
    if (method === 'POST' && pathname === '/app/login') {
      return this.login(parsed);
    }
    const expireAt = this.tokens.get(headers['X-Gizwits-User-Token']);
    if (!expireAt || expireAt * 1000 <= this.now()) {
      return { status: 400, body: { error_code: 9004, error_message: 'token invalid!' } };
    }
    if (method === 'GET' && pathname === '/app/bindings') {
      const limit = Number(searchParams.get('limit') ?? 20);
      const skip = Number(searchParams.get('skip') ?? 0);
      const devices = [...this.devices.values()].map((device) => device.binding);
      return { status: 200, body: { devices: devices.slice(skip, skip + limit) } };
    }
    let match = pathname.match(/^\/app\/devdata\/([^/]+)\/latest$/);
    if (method === 'GET' && match) {
      const device = this.devices.get(decodeURIComponent(match[1]));
      if (!device) {
        return { status: 400, body: { error_code: 9014, error_message: 'device not found' } };
      }
      return {
        status: 200,
        body: {
          did: device.binding.did,
          updated_at: Math.floor(this.now() / 1000),
          attr: { ...device.attr },
        },
      };
    }
    match = pathname.match(/^\/app\/control\/([^/]+)$/);
    if (method === 'POST' && match) {
      return this.control(decodeURIComponent(match[1]), parsed);
    }
    return { status: 404, body: { error_code: 9999, error_message: 'not found' } };
  };

  login(body) {
    this.logins += 1;
    if (body?.username !== EMAIL || body?.password !== this.password) {
      return {
        status: 400,
        body: {
          error_code: 9020,
          error_message: 'Username or password error!',
          detail_message: null,
        },
      };
    }
    this.counter += 1;
    const token = `token-${this.counter}`;
    const expireAt = Math.floor(this.now() / 1000) + this.tokenLifetimeS;
    this.tokens.set(token, expireAt);
    return { status: 200, body: { token, uid: 'uid-fixture', expire_at: expireAt } };
  }

  control(did, body) {
    const device = this.devices.get(did);
    if (!device) {
      return { status: 400, body: { error_code: 9014, error_message: 'device not found' } };
    }
    if (device.binding.is_online === false) {
      return { status: 400, body: { error_code: 9042, error_message: 'device not online' } };
    }
    if (Array.isArray(body?.raw)) {
      const mode = V1_MODES[body.raw[2]];
      if (!mode) {
        return { status: 400, body: { error_code: 9015, error_message: 'form invalid' } };
      }
      device.attr.mode = mode;
      return { status: 200, body: {} };
    }
    if (!body?.attrs || typeof body.attrs !== 'object') {
      return { status: 400, body: { error_code: 9015, error_message: 'form invalid' } };
    }
    Object.assign(device.attr, body.attrs);
    // The Pilote Pro reports the mode it applies in cur_mode.
    if (
      'mode' in body.attrs &&
      'cur_mode' in device.attr &&
      typeof device.attr.cur_mode === 'string'
    ) {
      device.attr.cur_mode = body.attrs.mode;
    }
    return { status: 200, body: {} };
  }
}
