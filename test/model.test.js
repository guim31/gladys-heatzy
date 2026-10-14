// -----------------------------------------------------------------------------
// The module model on the real devices of the hass-heatzy fixtures: mode codes
// of each generation, temperatures, and the commands sent for each mode.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PILOT_WIRE,
  UnsupportedCommand,
  applyCommand,
  modeCommand,
  parseModule,
  switchCommand,
  vacationCommand,
} from '../src/heatzy/model.js';
import { loadFixture } from './helpers/fakeGizwits.js';

const parse = (name, patch = {}) => {
  const { binding, latest } = loadFixture(name);
  return parseModule(binding, { ...latest.attr, ...patch });
};

test('each generation reads its mode, temperature and switches', () => {
  const expected = {
    'pilote-v1': { generation: 'pilote_v1', mode: PILOT_WIRE.ECO, lock: null, temperature: null },
    'pilote-v2': { generation: 'pilote_v2', mode: PILOT_WIRE.COMFORT, lock: 0, temperature: null },
    'pilote-v3': {
      generation: 'pilote_v2',
      mode: PILOT_WIRE.FROST_PROTECTION,
      lock: 0,
      temperature: null,
    },
    'pilote-v4': {
      generation: 'pilote_v4',
      mode: PILOT_WIRE.COMFORT_1,
      lock: 0,
      temperature: null,
    },
    // The Pilote Pro reports the mode it applies in cur_mode (stop here), as
    // hass-heatzy reads it, not the requested mode (cft).
    'pilote-pro': { generation: 'pilote_pro', mode: PILOT_WIRE.OFF, lock: 0, temperature: 18.5 },
    glow: { generation: 'glow', mode: PILOT_WIRE.ECO, lock: 0, temperature: 19.6 },
    onyx: { generation: 'glow', mode: PILOT_WIRE.ECO, lock: 0, temperature: 19.9 },
    bloom: { generation: 'bloom', mode: PILOT_WIRE.COMFORT, lock: null, temperature: 16 },
  };
  for (const [name, values] of Object.entries(expected)) {
    const module = parse(name);
    for (const [key, value] of Object.entries(values)) {
      assert.equal(module[key], value, `${name}.${key}`);
    }
  }
  assert.equal(parse('pilote-pro').humidity, 57);
  assert.equal(parse('bloom').programming, 1);
  assert.equal(parse('pilote-v1').programming, null);
});

test('a Glow switched off reads Off whatever its last mode', () => {
  assert.equal(parse('glow', { on_off: false }).mode, PILOT_WIRE.OFF);
  assert.equal(parse('onyx', { on_off: 0 }).mode, PILOT_WIRE.OFF);
});

test('an unknown product key falls back on the common protocol', () => {
  const module = parseModule(
    { did: 'x', product_key: 'ffffffffffffffffffffffffffffffff', is_online: true },
    { mode: 'cft2', lock_switch: 1 },
  );
  assert.equal(module.generation, 'other');
  assert.equal(module.mode, PILOT_WIRE.COMFORT_2);
  assert.equal(module.lock, 1);
  assert.equal(module.programming, null);
});

test('the Pilote v1 is commanded by a raw frame', () => {
  const module = parse('pilote-v1');
  assert.deepEqual(modeCommand(module, PILOT_WIRE.COMFORT), { raw: [1, 1, 0] });
  assert.deepEqual(modeCommand(module, PILOT_WIRE.FROST_PROTECTION), { raw: [1, 1, 2] });
  assert.deepEqual(modeCommand(module, PILOT_WIRE.OFF), { raw: [1, 1, 3] });
  assert.throws(() => modeCommand(module, PILOT_WIRE.COMFORT_1), UnsupportedCommand);
  assert.throws(() => vacationCommand(module, 3), UnsupportedCommand);
  assert.equal(applyCommand(module, { raw: [1, 1, 1] }).mode, PILOT_WIRE.ECO);
});

test('later modules get the mode code, and comfort -1/-2 only when they have it', () => {
  assert.deepEqual(modeCommand(parse('pilote-v2'), PILOT_WIRE.ECO), { attrs: { mode: 'eco' } });
  assert.throws(() => modeCommand(parse('pilote-v2'), PILOT_WIRE.COMFORT_2), UnsupportedCommand);
  assert.deepEqual(modeCommand(parse('pilote-v4'), PILOT_WIRE.COMFORT_2), {
    attrs: { mode: 'cft2' },
  });
});

test('a mode ends the vacation in progress', () => {
  const module = parse('pilote-v2', { derog_mode: 1, derog_time: 5 });
  assert.deepEqual(modeCommand(module, PILOT_WIRE.COMFORT), {
    attrs: { mode: 'cft', derog_mode: 0, derog_time: 0 },
  });
});

test('a Glow stops with on_off and starts again with its mode', () => {
  const glow = parse('glow');
  assert.deepEqual(modeCommand(glow, PILOT_WIRE.OFF), { attrs: { on_off: 0 } });
  assert.deepEqual(modeCommand(glow, PILOT_WIRE.COMFORT), { attrs: { mode: 'cft', on_off: 1 } });
  assert.equal(applyCommand(glow, { attrs: { on_off: 0 } }).mode, PILOT_WIRE.OFF);
});

test('vacation, child lock and programme commands', () => {
  const module = parse('pilote-v4');
  assert.deepEqual(vacationCommand(module, 7), { attrs: { derog_mode: 1, derog_time: 7 } });
  assert.deepEqual(vacationCommand(module, 0), { attrs: { derog_mode: 0, derog_time: 0 } });
  assert.deepEqual(switchCommand(module, 'lock', true), { attrs: { lock_switch: 1 } });
  assert.deepEqual(switchCommand(parse('glow'), 'lock', false), { attrs: { LOCK_C: 0 } });
  assert.deepEqual(switchCommand(module, 'programming', false), { attrs: { timer_switch: 0 } });
  assert.throws(() => switchCommand(parse('pilote-v1'), 'lock', true), UnsupportedCommand);
  const next = applyCommand(module, { attrs: { derog_mode: 1, derog_time: 7, lock_switch: 1 } });
  assert.equal(next.derogation, 1);
  assert.equal(next.derogationTime, 7);
  assert.equal(next.lock, 1);
});
