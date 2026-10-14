// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+): `radiators`.
//
// The use case: the wall tablet in the hall, "everything to eco, we are going
// out". So the widget lists the radiators with their mode (and the room
// temperature on the models that measure it), and offers four direct buttons:
// Comfort, Eco, Frost protection, Off. Off asks for a confirmation: it is the
// only one that leaves a room unheated.
//
// Every module by default, or the one chosen in the widget settings. The
// buttons act on what the widget shows; the current mode carries a check mark
// (when every shown module is in it), never the `primary` style, invisible in
// dark mode. Comfort -1 / -2 stay on the device (pilot-wire selector).
//
// Budget (8 components, 1 status, 4 buttons): one status list (up to ten
// radiators), four buttons; the values are sent as text, not bound to device
// features, so the widget works before the devices are added to Gladys.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { moduleName } from './devices.js';
import { WIDGET_KEY } from './hub.js';
import { DEROGATION, MODE_BY_KEY, MODE_KEYS, PILOT_WIRE } from './heatzy/model.js';
import { MODE_TEXT, pick } from './texts.js';

// Action keys of the buttons: permanent once published (unique, the core
// drops a button whose key is taken).
export const ACTIONS = Object.freeze({
  COMFORT: 'mode_comfort',
  ECO: 'mode_eco',
  FROST_PROTECTION: 'mode_frost_protection',
  OFF: 'mode_off',
});

const BUTTONS = [
  { key: ACTIONS.COMFORT, mode: 'comfort', icon: 'sun' },
  { key: ACTIONS.ECO, mode: 'eco', icon: 'moon' },
  { key: ACTIONS.FROST_PROTECTION, mode: 'frost_protection', icon: 'cloud-snow' },
  { key: ACTIONS.OFF, mode: 'off', icon: 'power', confirm: true },
];

const ACTIVE_ICON = 'check-circle';
export const MAX_ROWS = 10;

export const TEXT = {
  noAccount: {
    en: 'Enter your Heatzy account in the configuration of the integration.',
    fr: "Saisissez votre compte Heatzy dans la configuration de l'intégration.",
    de: 'Gib dein Heatzy-Konto in der Konfiguration der Integration ein.',
    es: 'Introduzca su cuenta Heatzy en la configuración de la integración.',
  },
  noModule: {
    en: 'No Heatzy module found yet: see the Configuration screen of the integration.',
    fr: "Aucun module Heatzy trouvé pour l'instant : voir l'écran Configuration de l'intégration.",
    de: 'Noch kein Heatzy-Modul gefunden: Sieh dir die Konfiguration der Integration an.',
    es: 'Aún no se ha encontrado ningún módulo Heatzy: consulte la pantalla de configuración de la integración.',
  },
  unknown: {
    en: 'This module is no longer on the Heatzy account: choose another one in the widget settings.',
    fr: "Ce module n'est plus sur le compte Heatzy : choisissez-en un autre dans les réglages du widget.",
    de: 'Dieses Modul ist nicht mehr im Heatzy-Konto: Wähle ein anderes in den Widget-Einstellungen.',
    es: 'Este módulo ya no está en la cuenta Heatzy: elija otro en la configuración del widget.',
  },
  offline: { en: 'Offline', fr: 'Hors ligne', de: 'Offline', es: 'Desconectado' },
  waiting: { en: 'Waiting…', fr: 'En attente…', de: 'Warte…', es: 'Esperando…' },
  vacation: { en: 'vacation', fr: 'vacances', de: 'Urlaub', es: 'vacaciones' },
  day: { en: 'd', fr: 'j', de: 'T', es: 'd' },
  boost: { en: 'boost', fr: 'boost', de: 'Boost', es: 'boost' },
  programme: { en: 'programme', fr: 'programme', de: 'Programm', es: 'programa' },
  more: {
    en: 'Other radiators',
    fr: 'Autres radiateurs',
    de: 'Weitere Heizkörper',
    es: 'Otros radiadores',
  },
};

// Toasts after a tap (≤ 200 characters).
export const DONE_TEXT = {
  en: { done: (mode, count) => `${mode}: ${count} radiator(s).` },
  fr: { done: (mode, count) => `${mode} : ${count} radiateur(s).` },
  de: { done: (mode, count) => `${mode}: ${count} Heizkörper.` },
  es: { done: (mode, count) => `${mode}: ${count} radiador(es).` },
};

const t = (text, language) => pick(text, language);
const fit = (text, max) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

const MODE_COLORS = {
  [PILOT_WIRE.COMFORT]: WIDGET_COLORS.WARNING,
  [PILOT_WIRE.COMFORT_1]: WIDGET_COLORS.WARNING,
  [PILOT_WIRE.COMFORT_2]: WIDGET_COLORS.WARNING,
  [PILOT_WIRE.ECO]: WIDGET_COLORS.SUCCESS,
  [PILOT_WIRE.FROST_PROTECTION]: WIDGET_COLORS.INFO,
  [PILOT_WIRE.OFF]: WIDGET_COLORS.NEUTRAL,
};

function message(text, language) {
  return {
    ttl_seconds: 300,
    components: [{ type: 'text', variant: 'body', text: t(text, language) }],
  };
}

const formatTemperature = (value, language) =>
  `${new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value)} °C`;

/** The status row of one module. */
export function moduleRow(module, language) {
  const label = fit(moduleName(module), 40);
  if (!module.online) {
    return {
      label,
      icon: 'wifi-off',
      value: t(TEXT.offline, language),
      color: WIDGET_COLORS.DANGER,
    };
  }
  if (module.mode === null) {
    return { label, icon: 'clock', value: t(TEXT.waiting, language), color: WIDGET_COLORS.NEUTRAL };
  }
  const parts = [t(MODE_TEXT[MODE_KEYS[module.mode]], language)];
  if (module.derogation === DEROGATION.VACATION) {
    parts.push(
      module.derogationTime > 0
        ? `${t(TEXT.vacation, language)} ${module.derogationTime} ${t(TEXT.day, language)}`
        : t(TEXT.vacation, language),
    );
  } else if (module.derogation === DEROGATION.BOOST) {
    parts.push(t(TEXT.boost, language));
  } else if (module.programming === 1) {
    parts.push(t(TEXT.programme, language));
  }
  if (module.temperature !== null) {
    parts.push(formatTemperature(module.temperature, language));
  }
  return {
    label,
    icon: 'thermometer',
    value: fit(parts.join(' · '), 40),
    color: MODE_COLORS[module.mode],
  };
}

function view(hub, deviceExternalId) {
  if (!deviceExternalId) {
    return [...hub.modules.values()];
  }
  try {
    return hub.targets(deviceExternalId);
  } catch {
    return [];
  }
}

async function get(hub, { settings, language = 'fr' }) {
  if (!hub.client) {
    return message(TEXT.noAccount, language);
  }
  if (hub.modules.size === 0) {
    return message(TEXT.noModule, language);
  }
  const modules = view(hub, settings?.device);
  if (modules.length === 0) {
    return message(TEXT.unknown, language);
  }
  const items = modules.slice(0, MAX_ROWS).map((module) => moduleRow(module, language));
  if (modules.length > MAX_ROWS) {
    items[MAX_ROWS - 1] = {
      label: t(TEXT.more, language),
      icon: 'more-horizontal',
      value: modules.length - (MAX_ROWS - 1),
      color: WIDGET_COLORS.NEUTRAL,
    };
  }
  const online = modules.filter((module) => module.online);
  const components = [{ type: 'status', items }];
  for (const button of BUTTONS) {
    const mode = MODE_BY_KEY[button.mode];
    const active = online.length > 0 && online.every((module) => module.mode === mode);
    components.push({
      type: 'button',
      label: t(MODE_TEXT[button.mode], language),
      icon: active ? ACTIVE_ICON : button.icon,
      style: button.confirm ? 'danger' : 'secondary',
      action: {
        key: button.key,
        params: { mode: button.mode },
        ...(button.confirm ? { confirm: true } : {}),
      },
    });
  }
  return { ttl_seconds: 60, components };
}

async function action(hub, { actionKey, settings }) {
  const button = BUTTONS.find((entry) => entry.key === actionKey);
  if (!button) {
    throw new Error(`Unknown action ${actionKey}`);
  }
  // The mode comes from the action key, never from the params of the tap.
  const count = await hub.setMode(settings?.device || null, MODE_BY_KEY[button.mode]);
  return {
    message: Object.fromEntries(
      Object.entries(DONE_TEXT).map(([language, text]) => [
        language,
        text.done(pick(MODE_TEXT[button.mode], language), count),
      ]),
    ),
  };
}

export const WIDGETS = {
  [WIDGET_KEY]: { get, action },
};
