// -----------------------------------------------------------------------------
// What a Heatzy module is, from the Gizwits product key it reports, and how
// its raw attributes translate to Gladys values and back.
//
// The product keys, the attribute names and the mode codes of each module
// generation come from hass-heatzy by Cyr-ius (MIT), checked against the
// device fixtures of its tests. Gizwits mode codes:
//   - Pilote v1: the attribute `mode` holds Chinese words (舒适 comfort,
//     经济 eco, 解冻 frost protection, 停止 stop), and a command is a raw frame
//     [1, 1, n] (n: 0 comfort, 1 eco, 2 frost protection, 3 stop);
//   - every later module: `mode` is cft, eco, fro, stop, and cft1 / cft2
//     (comfort -1 / -2 °C) on the modules that have them; a command sends
//     `{ attrs: { mode } }`.
// Glow, Onyx and Inea stop with `on_off: 0` and keep their last mode; the
// Pilote Pro reports the mode it is applying in `cur_mode`.
// -----------------------------------------------------------------------------

// Gladys pilot-wire values (PILOT_WIRE_MODE of the core, heater/pilot-wire-mode).
export const PILOT_WIRE = Object.freeze({
  OFF: 0,
  FROST_PROTECTION: 1,
  ECO: 2,
  COMFORT_1: 3,
  COMFORT_2: 4,
  COMFORT: 5,
});

// Stable mode keys of the scene triggers, actions and widget: permanent once published.
export const MODE_KEYS = Object.freeze({
  [PILOT_WIRE.OFF]: 'off',
  [PILOT_WIRE.FROST_PROTECTION]: 'frost_protection',
  [PILOT_WIRE.ECO]: 'eco',
  [PILOT_WIRE.COMFORT_1]: 'comfort_1',
  [PILOT_WIRE.COMFORT_2]: 'comfort_2',
  [PILOT_WIRE.COMFORT]: 'comfort',
});
export const MODE_BY_KEY = Object.freeze(
  Object.fromEntries(Object.entries(MODE_KEYS).map(([value, key]) => [key, Number(value)])),
);

const FOUR_MODES = [
  PILOT_WIRE.COMFORT,
  PILOT_WIRE.ECO,
  PILOT_WIRE.FROST_PROTECTION,
  PILOT_WIRE.OFF,
];
const SIX_MODES = [
  PILOT_WIRE.COMFORT,
  PILOT_WIRE.COMFORT_1,
  PILOT_WIRE.COMFORT_2,
  PILOT_WIRE.ECO,
  PILOT_WIRE.FROST_PROTECTION,
  PILOT_WIRE.OFF,
];

const CODE_TO_MODE = {
  cft: PILOT_WIRE.COMFORT,
  cft1: PILOT_WIRE.COMFORT_1,
  cft2: PILOT_WIRE.COMFORT_2,
  eco: PILOT_WIRE.ECO,
  fro: PILOT_WIRE.FROST_PROTECTION,
  stop: PILOT_WIRE.OFF,
};
const MODE_TO_CODE = Object.fromEntries(
  Object.entries(CODE_TO_MODE).map(([code, mode]) => [mode, code]),
);

const V1_CODE_TO_MODE = {
  舒适: PILOT_WIRE.COMFORT,
  经济: PILOT_WIRE.ECO,
  解冻: PILOT_WIRE.FROST_PROTECTION,
  停止: PILOT_WIRE.OFF,
};
const V1_RAW = {
  [PILOT_WIRE.COMFORT]: 0,
  [PILOT_WIRE.ECO]: 1,
  [PILOT_WIRE.FROST_PROTECTION]: 2,
  [PILOT_WIRE.OFF]: 3,
};

// Derogation codes (`derog_mode`): what overrides the mode for a while.
export const DEROGATION = Object.freeze({ NONE: 0, VACATION: 1, BOOST: 2, PRESENCE: 3 });
export const MAX_VACATION_DAYS = 255;

/**
 * Module generations. `temperature` reads the room temperature in °C from the
 * attributes, `lock` and `programming` name the attributes of the child lock
 * and of the weekly programme.
 */
export const GENERATIONS = {
  pilote_v1: { model: 'Pilote v1', modes: FOUR_MODES, v1: true, vacation: false },
  pilote_v2: {
    model: 'Pilote v2',
    modes: FOUR_MODES,
    lock: 'lock_switch',
    programming: 'timer_switch',
    vacation: true,
  },
  pilote_v4: {
    model: 'Pilote v4',
    modes: SIX_MODES,
    lock: 'lock_switch',
    programming: 'timer_switch',
    vacation: true,
  },
  pilote_pro: {
    model: 'Pilote Pro',
    modes: SIX_MODES,
    lock: 'lock_switch',
    programming: 'timer_switch',
    vacation: true,
    modeAttribute: 'cur_mode',
    temperature: (attrs) => tenths(attrs.cur_temp),
    humidity: (attrs) => (isNumber(attrs.cur_humi) ? attrs.cur_humi : null),
  },
  glow: {
    model: 'Glow',
    modes: SIX_MODES,
    lock: 'LOCK_C',
    programming: 'timer_switch',
    vacation: true,
    onOff: true,
    temperature: (attrs) =>
      isNumber(attrs.cur_tempL) ? (attrs.cur_tempL + (attrs.cur_tempH ?? 0) * 256) / 10 : null,
  },
  bloom: {
    model: 'Bloom',
    modes: SIX_MODES,
    // No child lock: hass-heatzy offers lock_switch, but the real Bloom of its
    // fixtures does not report it, and a feature that never gets a value is noise.
    programming: 'timer_switch',
    vacation: true,
    // Whole degrees on this model (hass-heatzy reads it as is).
    temperature: (attrs) => (isNumber(attrs.cur_temp) ? attrs.cur_temp : null),
  },
  // A product key unknown to hass-heatzy: the common v2+ protocol, its
  // optional features only when the module reports them.
  other: { model: 'Heatzy', modes: SIX_MODES, vacation: true, guessed: true },
};

// Product key → [generation, model name shown in Gladys].
export const PRODUCT_KEYS = {
  '9420ae048da545c88fc6274d204dd25f': ['pilote_v1', 'Pilote v1'],
  '51d16c22a5f74280bc3cfe9ebcdc6402': ['pilote_v2', 'Pilote v2'],
  '4fc968a21e7243b390e9ede6f1c6465d': ['pilote_v2', 'Pilote v2 Elec Pro'],
  b9a67b6ce24b437d9794103fd317e627: ['pilote_v2', 'Pilote v3'],
  b8c6657b66c34148b4dee64d615cefc7: ['pilote_v2', 'Pilote v3 Elec Pro'],
  '9dacde7ef459421eaf8dc4bea9385634': ['pilote_v4', 'Pilote v4 Elec Pro'],
  '46409c7f29d4411c85a3a46e5ee3703e': ['pilote_v4', 'Pilote v4'], // also sold by Sauter
  a77a929fcf0d4631bc4f669080376891: ['pilote_pro', 'Pilote Pro'],
  '2fd622e45283470f9e27e8e6167d7533': ['glow', 'Glow'],
  bb10d064f8de409db633b750faa22a52: ['glow', 'Onyx'],
  fc89066ee74c4149a9beb37d4ea93604: ['glow', 'Inea'],
  '480253852d574f11b2d7fbf4460d7a41': ['bloom', 'Bloom'],
};

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function tenths(value) {
  return isNumber(value) ? value / 10 : null;
}

/** 0/1 of an attribute that is a number or a boolean, null when absent. */
function flag(value) {
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (isNumber(value)) {
    return value ? 1 : 0;
  }
  return null;
}

/** The generation key of a module (`bindings` entry). */
export function generationOf(binding) {
  return PRODUCT_KEYS[binding?.product_key]?.[0] ?? 'other';
}

/**
 * What a module offers, from its generation, completed for unknown products
 * by the attributes it reports.
 */
export function capabilitiesOf(generationKey, attrs = {}) {
  const generation = GENERATIONS[generationKey] ?? GENERATIONS.other;
  if (!generation.guessed) {
    return generation;
  }
  return {
    ...generation,
    lock: 'lock_switch' in attrs ? 'lock_switch' : 'LOCK_C' in attrs ? 'LOCK_C' : undefined,
    programming: 'timer_switch' in attrs ? 'timer_switch' : undefined,
  };
}

/** Gladys pilot-wire value of the attributes, null when unknown. */
export function readMode(capabilities, attrs) {
  if (capabilities.onOff && flag(attrs.on_off) === 0) {
    return PILOT_WIRE.OFF;
  }
  if (capabilities.v1) {
    return V1_CODE_TO_MODE[attrs.mode] ?? null;
  }
  const code = attrs[capabilities.modeAttribute ?? 'mode'];
  return (
    CODE_TO_MODE[code] ?? (capabilities.modeAttribute ? (CODE_TO_MODE[attrs.mode] ?? null) : null)
  );
}

/**
 * Everything the integration shows of a module.
 * @param {object} binding entry of /app/bindings (did, dev_alias, product_key, is_online…)
 * @param {object|null} attrs `attr` of /app/devdata/<did>/latest, null when not read
 */
export function parseModule(binding, attrs) {
  const generation = generationOf(binding);
  const capabilities = capabilitiesOf(generation, attrs ?? {});
  const values = attrs ?? {};
  const derogation = isNumber(values.derog_mode) ? values.derog_mode : DEROGATION.NONE;
  return {
    did: binding.did,
    name:
      typeof binding.dev_alias === 'string' && binding.dev_alias.trim()
        ? binding.dev_alias.trim()
        : null,
    model:
      PRODUCT_KEYS[binding.product_key]?.[1] ??
      (typeof binding.product_name === 'string' && binding.product_name
        ? binding.product_name
        : capabilities.model),
    generation,
    capabilities,
    online: binding.is_online !== false,
    read: attrs !== null && attrs !== undefined,
    mode: attrs ? readMode(capabilities, values) : null,
    lock: attrs && capabilities.lock ? flag(values[capabilities.lock]) : null,
    programming: attrs && capabilities.programming ? flag(values[capabilities.programming]) : null,
    derogation: attrs ? derogation : null,
    derogationTime: isNumber(values.derog_time) ? values.derog_time : 0,
    temperature: attrs && capabilities.temperature ? capabilities.temperature(values) : null,
    humidity: attrs && capabilities.humidity ? capabilities.humidity(values) : null,
  };
}

/** Error raised for a command the module cannot carry out. */
export class UnsupportedCommand extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'UnsupportedCommand';
    this.reason = reason; // 'mode' | 'vacation' | 'lock' | 'programming'
  }
}

/**
 * Control payload (/app/control/<did>) that puts a module in a pilot-wire mode.
 * A derogation in progress (vacation, boost) is ended, as hass-heatzy does,
 * otherwise the module would ignore the new mode until it expires.
 */
export function modeCommand(module, mode) {
  const { capabilities } = module;
  if (!capabilities.modes.includes(mode)) {
    throw new UnsupportedCommand('mode');
  }
  if (capabilities.v1) {
    return { raw: [1, 1, V1_RAW[mode]] };
  }
  const attrs = {};
  if (capabilities.onOff && mode === PILOT_WIRE.OFF) {
    attrs.on_off = 0;
  } else {
    attrs.mode = MODE_TO_CODE[mode];
    if (capabilities.onOff) {
      attrs.on_off = 1;
    }
  }
  if (module.derogation) {
    attrs.derog_mode = DEROGATION.NONE;
    attrs.derog_time = 0;
  }
  return { attrs };
}

/** Vacation (frost protection for `days` days), or its end when `days` is 0. */
export function vacationCommand(module, days) {
  if (!module.capabilities.vacation) {
    throw new UnsupportedCommand('vacation');
  }
  return days > 0
    ? { attrs: { derog_mode: DEROGATION.VACATION, derog_time: days } }
    : { attrs: { derog_mode: DEROGATION.NONE, derog_time: 0 } };
}

/** Child lock or weekly programme on/off. */
export function switchCommand(module, which, on) {
  const attribute = module.capabilities[which];
  if (!attribute) {
    throw new UnsupportedCommand(which);
  }
  return { attrs: { [attribute]: on ? 1 : 0 } };
}

/**
 * The module as it will be once the command is applied, so the new state is
 * published without waiting for the next reading.
 */
export function applyCommand(module, payload) {
  if (payload.raw) {
    const mode = Number(Object.keys(V1_RAW).find((key) => V1_RAW[key] === payload.raw[2]));
    return { ...module, mode };
  }
  const { attrs } = payload;
  const next = { ...module };
  if ('mode' in attrs) {
    next.mode = CODE_TO_MODE[attrs.mode];
  }
  if (attrs.on_off === 0) {
    next.mode = PILOT_WIRE.OFF;
  }
  if ('derog_mode' in attrs) {
    next.derogation = attrs.derog_mode;
    next.derogationTime = attrs.derog_time ?? 0;
  }
  for (const which of ['lock', 'programming']) {
    const attribute = module.capabilities[which];
    if (attribute && attribute in attrs) {
      next[which] = attrs[attribute];
    }
  }
  return next;
}
