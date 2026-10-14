// -----------------------------------------------------------------------------
// The `radiators` widget: content within the core's vocabulary and budget,
// the rows of each module, the buttons and their commands.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { WIDGET_KEY } from '../src/hub.js';
import { ACTIONS } from '../src/widgets.js';
import { ACCOUNT, createWorld, deviceId } from './helpers/world.js';

const get = async (world, settings = {}, language = 'fr') => {
  const ack = await world.fake.widgetGet(WIDGET_KEY, { settings, language });
  assert.equal(ack.success, true, ack.error);
  const { content } = ack.data;
  assert.deepEqual(validateWidgetContent(content), [], JSON.stringify(content));
  return content;
};

test('every radiator gets a row, with four buttons, in every language', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  for (const language of ['en', 'fr', 'de', 'es']) {
    const content = await get(world, {}, language);
    const [status, ...buttons] = content.components;
    assert.equal(status.type, 'status');
    assert.equal(status.items.length, 8);
    assert.deepEqual(
      buttons.map((button) => button.action.key),
      [ACTIONS.COMFORT, ACTIONS.ECO, ACTIONS.FROST_PROTECTION, ACTIONS.OFF],
    );
    // Only Off asks for a confirmation.
    assert.deepEqual(
      buttons.map((button) => button.action.confirm === true),
      [false, false, false, true],
    );
  }
  const content = await get(world);
  const glow = content.components[0].items.find((item) => item.label === 'Chambre parents');
  assert.equal(glow.value, 'Eco · 19,6 °C');
  const bloom = content.components[0].items.find((item) => item.label === 'Entrée');
  assert.equal(bloom.value, 'Confort · programme · 16 °C');
});

test('one radiator: its row, and the check mark on its mode', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const content = await get(world, { device: deviceId(world, 'pilote-v3') });
  assert.equal(content.components[0].items.length, 1);
  const marked = content.components.filter((c) => c.type === 'button' && c.icon === 'check-circle');
  assert.deepEqual(
    marked.map((button) => button.action.key),
    [ACTIONS.FROST_PROTECTION],
  );
});

test('a button sets the mode of what the widget shows', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const one = await world.fake.widgetAction(
    WIDGET_KEY,
    ACTIONS.ECO,
    { mode: 'eco' },
    {
      settings: { device: deviceId(world, 'bloom') },
    },
  );
  assert.equal(one.success, true, one.error);
  assert.equal(world.cloud.attr('bloom').mode, 'eco');
  const all = await world.fake.widgetAction(
    WIDGET_KEY,
    ACTIONS.OFF,
    { mode: 'off' },
    {
      settings: {},
    },
  );
  assert.equal(all.success, true, all.error);
  assert.match(JSON.stringify(all.data), /8 radiateur/);
  assert.equal(world.cloud.attr('glow').on_off, false);
  // The mode comes from the action key, not from the params.
  await world.fake.widgetAction(WIDGET_KEY, ACTIONS.ECO, { mode: 'off' }, { settings: {} });
  assert.equal(world.cloud.attr('pilote-v2').mode, 'eco');
});

test('offline modules, vacation and the empty states', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  world.cloud.setOnline('onyx', false);
  world.cloud.attr('pilote-v4').derog_mode = 1;
  world.cloud.attr('pilote-v4').derog_time = 6;
  await world.hub.poll();
  const items = (await get(world, {}, 'en')).components[0].items;
  assert.equal(items.find((i) => i.label === 'Salle de bain').value, 'Offline');
  assert.equal(items.find((i) => i.label === 'Cuisine').value, 'Comfort -1°C · vacation 6 d');

  const unknown = await get(world, { device: 'ext:test-integration:module:gone' });
  assert.equal(unknown.components[0].type, 'text');

  const empty = await createWorld({ config: {} });
  t.after(() => empty.app.stop());
  assert.equal((await get(empty)).components[0].type, 'text');
  const none = await createWorld({ modules: [], config: ACCOUNT });
  t.after(() => none.app.stop());
  assert.equal((await get(none)).components[0].type, 'text');
});
