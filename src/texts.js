// -----------------------------------------------------------------------------
// Texts sent from the container (connection status, action errors, reports),
// in the four languages of the Gladys interface. German says "du", Spanish
// "usted". The language is the one chosen in the configuration: Gladys does
// not tell a device integration or a scene action the user's language.
// -----------------------------------------------------------------------------

import { ERROR_KINDS } from './heatzy/client.js';

export const pick = (text, language) => text?.[language] ?? text?.fr ?? text?.en ?? '';

export const INIT_FAILED = {
  en: 'The integration could not start: see its logs.',
  fr: "L'intégration n'a pas pu démarrer : voir ses journaux.",
  de: 'Die Integration konnte nicht starten: Sieh dir ihre Protokolle an.',
  es: 'La integración no ha podido iniciarse: consulte sus registros.',
};

export const CONNECTION_TEXT = {
  noAccount: {
    en: 'Enter the e-mail address and password of your Heatzy account in the configuration.',
    fr: "Saisissez l'adresse e-mail et le mot de passe de votre compte Heatzy dans la configuration.",
    de: 'Gib die E-Mail-Adresse und das Passwort deines Heatzy-Kontos in der Konfiguration ein.',
    es: 'Introduzca la dirección de correo y la contraseña de su cuenta Heatzy en la configuración.',
  },
  noModule: {
    en: 'Connected, but the Heatzy account has no module.',
    fr: "Connecté, mais le compte Heatzy n'a aucun module.",
    de: 'Verbunden, aber das Heatzy-Konto hat kein Modul.',
    es: 'Conectado, pero la cuenta Heatzy no tiene ningún módulo.',
  },
};

// Why the cloud cannot be read (connection status, test report), ≤ 100 characters.
export const ERROR_TEXT = {
  [ERROR_KINDS.AUTH]: {
    en: 'Heatzy refuses the e-mail address or the password.',
    fr: "Heatzy refuse l'adresse e-mail ou le mot de passe.",
    de: 'Heatzy lehnt die E-Mail-Adresse oder das Passwort ab.',
    es: 'Heatzy rechaza la dirección de correo o la contraseña.',
  },
  [ERROR_KINDS.UNREACHABLE]: {
    en: 'The Heatzy cloud does not answer.',
    fr: 'Le cloud Heatzy ne répond pas.',
    de: 'Die Heatzy-Cloud antwortet nicht.',
    es: 'La nube de Heatzy no responde.',
  },
  [ERROR_KINDS.RATE_LIMITED]: {
    en: 'Too many requests: the Heatzy cloud asks to wait.',
    fr: 'Trop de requêtes : le cloud Heatzy demande de patienter.',
    de: 'Zu viele Anfragen: Die Heatzy-Cloud bittet zu warten.',
    es: 'Demasiadas solicitudes: la nube de Heatzy pide esperar.',
  },
  [ERROR_KINDS.OFFLINE]: {
    en: 'The module is offline.',
    fr: 'Le module est hors ligne.',
    de: 'Das Modul ist offline.',
    es: 'El módulo está desconectado.',
  },
  [ERROR_KINDS.REFUSED]: {
    en: 'The Heatzy cloud refused the request.',
    fr: 'Le cloud Heatzy a refusé la requête.',
    de: 'Die Heatzy-Cloud hat die Anfrage abgelehnt.',
    es: 'La nube de Heatzy ha rechazado la solicitud.',
  },
};

// Errors of a command (scene action, widget, device), ≤ 200 characters.
export const ACTION_TEXT = {
  noModule: {
    en: 'No Heatzy module: check the configuration of the integration.',
    fr: "Aucun module Heatzy : vérifiez la configuration de l'intégration.",
    de: 'Kein Heatzy-Modul: Prüfe die Konfiguration der Integration.',
    es: 'Ningún módulo Heatzy: compruebe la configuración de la integración.',
  },
  unknownModule: {
    en: 'This module is no longer on the Heatzy account.',
    fr: "Ce module n'est plus sur le compte Heatzy.",
    de: 'Dieses Modul ist nicht mehr im Heatzy-Konto.',
    es: 'Este módulo ya no está en la cuenta Heatzy.',
  },
  unknownMode: {
    en: 'Unknown mode.',
    fr: 'Mode inconnu.',
    de: 'Unbekannter Modus.',
    es: 'Modo desconocido.',
  },
  unsupportedMode: {
    en: 'This module does not offer this mode (comfort -1 and -2 need a Pilote v4, Pro, Glow or Bloom).',
    fr: 'Ce module ne propose pas ce mode (confort -1 et -2 demandent un Pilote v4, Pro, Glow ou Bloom).',
    de: 'Dieses Modul bietet diesen Modus nicht (Komfort -1 und -2 brauchen ein Pilote v4, Pro, Glow oder Bloom).',
    es: 'Este módulo no ofrece este modo (confort -1 y -2 requieren un Pilote v4, Pro, Glow o Bloom).',
  },
  unsupportedVacation: {
    en: 'The Pilote v1 has no vacation mode.',
    fr: "Le Pilote v1 n'a pas de mode vacances.",
    de: 'Das Pilote v1 hat keinen Urlaubsmodus.',
    es: 'El Pilote v1 no tiene modo vacaciones.',
  },
  unsupported: {
    en: 'This module cannot do that.',
    fr: 'Ce module ne sait pas le faire.',
    de: 'Dieses Modul kann das nicht.',
    es: 'Este módulo no puede hacerlo.',
  },
  badDays: {
    en: 'The number of days must be between 1 and 255.',
    fr: 'Le nombre de jours doit être compris entre 1 et 255.',
    de: 'Die Anzahl der Tage muss zwischen 1 und 255 liegen.',
    es: 'El número de días debe estar entre 1 y 255.',
  },
  failed: {
    en: 'No module accepted the command.',
    fr: "Aucun module n'a accepté la commande.",
    de: 'Kein Modul hat den Befehl angenommen.',
    es: 'Ningún módulo ha aceptado la orden.',
  },
};

/** "<name>: <text>", with the typography of each language. */
export const labelled = (name, text, language) =>
  language === 'fr' ? `${name} : ${text}` : `${name}: ${text}`;

// "Test the connection" report.
export const REPORT_TEXT = {
  en: {
    found: (count) => `Connected to Heatzy: ${count} module(s).`,
    offline: 'offline',
  },
  fr: {
    found: (count) => `Connecté à Heatzy : ${count} module(s).`,
    offline: 'hors ligne',
  },
  de: {
    found: (count) => `Mit Heatzy verbunden: ${count} Modul(e).`,
    offline: 'offline',
  },
  es: {
    found: (count) => `Conectado a Heatzy: ${count} módulo(s).`,
    offline: 'desconectado',
  },
};

// Names of the pilot-wire modes, by mode key: the words of the Gladys interface
// (Spanish shortened, "Protección antihielo" does not fit a widget button).
export const MODE_TEXT = {
  comfort: { en: 'Comfort', fr: 'Confort', de: 'Komfort', es: 'Confort' },
  comfort_1: { en: 'Comfort -1°C', fr: 'Confort -1°C', de: 'Komfort -1°C', es: 'Confort -1°C' },
  comfort_2: { en: 'Comfort -2°C', fr: 'Confort -2°C', de: 'Komfort -2°C', es: 'Confort -2°C' },
  eco: { en: 'Eco', fr: 'Eco', de: 'Öko', es: 'Eco' },
  frost_protection: {
    en: 'Frost protection',
    fr: 'Hors gel',
    de: 'Frostschutz',
    es: 'Antihielo',
  },
  off: { en: 'Off', fr: 'Off', de: 'Aus', es: 'Apagado' },
};
