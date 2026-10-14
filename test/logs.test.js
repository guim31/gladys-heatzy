// -----------------------------------------------------------------------------
// Quiet logs: a normal reading writes nothing at info level, a repeated error
// is written once, and no log line ever holds the e-mail, the password or the
// token.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMAIL, PASSWORD } from './helpers/fakeGizwits.js';
import { createWorld } from './helpers/world.js';

function captureLogs(t) {
  const lines = [];
  for (const method of ['log', 'info', 'warn', 'error', 'debug']) {
    t.mock.method(console, method, (...args) => lines.push(args.map(String).join(' ')));
  }
  t.mock.method(process.stdout, 'write', (chunk) => {
    lines.push(String(chunk));
    return true;
  });
  t.mock.method(process.stderr, 'write', (chunk) => {
    lines.push(String(chunk));
    return true;
  });
  return { lines };
}

test('a normal reading writes nothing at info level; an outage writes one line each way', async (t) => {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = 'info';
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  const world = await createWorld();
  t.after(() => world.app.stop());
  const { lines } = captureLogs(t);
  await world.hub.poll();
  await world.hub.poll();
  assert.deepEqual(lines, []);

  world.cloud.failures.push('network');
  await world.hub.poll();
  world.cloud.failures.push('network');
  await world.hub.poll();
  await world.hub.poll();
  assert.equal(lines.filter((line) => /WARN/.test(line)).length, 1, lines.join('\n'));
  assert.equal(lines.filter((line) => /restored/.test(line)).length, 1, lines.join('\n'));
});

test('no log line holds the credentials or the token, even in debug', async (t) => {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = 'debug';
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  const { lines } = captureLogs(t);
  const world = await createWorld({
    config: { email: EMAIL, password: 'Wr0ngPa55!', language: 'en' },
  });
  await world.fake.configUpdated({ email: EMAIL, password: PASSWORD, language: 'en' });
  world.cloud.revokeTokens();
  await world.hub.poll();
  await world.fake.sceneAction('set_mode', { mode: 'comfort_2' });
  await world.app.stop();
  assert.ok(lines.length > 0);
  for (const secret of [EMAIL, PASSWORD, 'Wr0ngPa55!', 'token-']) {
    assert.deepEqual(
      lines.filter((line) => line.includes(secret)),
      [],
      `"${secret}" appears in the logs`,
    );
  }
});
