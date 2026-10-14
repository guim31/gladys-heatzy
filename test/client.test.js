// -----------------------------------------------------------------------------
// The Gizwits client against the simulated cloud: headers, token reuse and
// renewal, pagination, error kinds, and no secret in any error message.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ERROR_KINDS, HeatzyClient } from '../src/heatzy/client.js';
import { EMAIL, FakeGizwits, PASSWORD } from './helpers/fakeGizwits.js';
import { createClock } from './helpers/world.js';

function setup(options = {}) {
  const clock = createClock();
  const cloud = new FakeGizwits({ now: clock.now, ...options });
  const client = new HeatzyClient({
    email: EMAIL,
    password: PASSWORD,
    request: cloud.request,
    now: clock.now,
  });
  return { clock, cloud, client };
}

test('logs in once, then reuses the token', async () => {
  const { cloud, client } = setup();
  const modules = await client.getBindings();
  assert.equal(modules.length, 8);
  await client.getAttributes(modules[0].did);
  assert.equal(cloud.logins, 1);
  const [login, bindings] = cloud.requests;
  assert.equal(login.path, '/app/login');
  assert.deepEqual(login.body, { username: EMAIL, password: PASSWORD, lang: 'en' });
  assert.equal(bindings.headers['X-Gizwits-User-Token'], 'token-1');
  assert.equal(bindings.headers['X-Gizwits-Application-Id'], 'c70a66ff039d41b4a220e198b0fcc8b3');
});

test('a revoked token is renewed once, transparently', async () => {
  const { cloud, client } = setup();
  await client.getBindings();
  cloud.revokeTokens();
  await client.getBindings();
  assert.equal(cloud.logins, 2);
});

test('an expiring token is renewed before use', async () => {
  const { cloud, client, clock } = setup();
  await client.getBindings();
  clock.advance(cloud.tokenLifetimeS * 1000);
  await client.getBindings();
  assert.equal(cloud.logins, 2);
});

test('reads the module list page by page', async () => {
  const { cloud, client } = setup();
  const template = [...cloud.devices.values()][0];
  for (let i = 0; i < 150; i += 1) {
    cloud.devices.set(`extra${i}`, {
      binding: { ...template.binding, did: `extra${i}` },
      attr: {},
    });
  }
  const modules = await client.getBindings();
  assert.equal(modules.length, 158);
  const pages = cloud.requests.filter((request) => request.path === '/app/bindings');
  assert.deepEqual(
    pages.map((request) => request.query),
    ['limit=100&skip=0', 'limit=100&skip=100'],
  );
});

test('errors carry a kind and never the e-mail, the password or the token', async () => {
  const cases = [
    { prepare: (cloud) => (cloud.password = 'other'), kind: ERROR_KINDS.AUTH },
    { prepare: (cloud) => cloud.failures.push('network'), kind: ERROR_KINDS.UNREACHABLE },
    {
      prepare: (cloud) => cloud.failures.push({ status: 502, body: null }),
      kind: ERROR_KINDS.UNREACHABLE,
    },
    {
      prepare: (cloud) => cloud.failures.push({ status: 429, body: null }),
      kind: ERROR_KINDS.RATE_LIMITED,
    },
  ];
  for (const { prepare, kind } of cases) {
    const { cloud, client } = setup();
    prepare(cloud);
    const err = await client.getBindings().catch((error) => error);
    assert.equal(err.kind, kind, err.message);
    for (const secret of [EMAIL, PASSWORD, 'token-']) {
      assert.ok(!err.message.includes(secret), `${kind}: ${err.message}`);
    }
  }
});

test('a command to an offline module is an offline error', async () => {
  const { cloud, client } = setup();
  cloud.setOnline('glow', false);
  const err = await client.control(cloud.did('glow'), { attrs: { mode: 'eco' } }).catch((e) => e);
  assert.equal(err.kind, ERROR_KINDS.OFFLINE);
});

test('no login without credentials', async () => {
  const cloud = new FakeGizwits();
  const client = new HeatzyClient({ email: '', password: '', request: cloud.request });
  const err = await client.getBindings().catch((error) => error);
  assert.equal(err.kind, ERROR_KINDS.AUTH);
  assert.equal(cloud.requests.length, 0);
});

// Answers of the real Gizwits cloud (14/10/2026), captured with an invented
// account from the locked container: test/fixtures/heatzy/real/.
const real = (name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/heatzy/real/${name}.json`, import.meta.url), 'utf8'));

test('real cloud answers: unknown account, refused token', async () => {
  const { cloud, client } = setup();
  cloud.failures.push(real('login-user-not-found'));
  const err = await client.getBindings().catch((error) => error);
  assert.equal(err.kind, ERROR_KINDS.AUTH);

  await client.getBindings();
  cloud.failures.push(real('token-invalid'));
  assert.equal((await client.getBindings()).length, 8);
  assert.equal(cloud.logins, 2); // the forced answer replaced the first login
});
