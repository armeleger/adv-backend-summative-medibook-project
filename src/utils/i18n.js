// Locale loading for the feedback page. Locale files are read once when the
// module loads (startup), never inside a request handler.
const en = require('../../locales/en.json');
const fr = require('../../locales/fr.json');

const LOCALES = Object.freeze({ en, fr });
const DEFAULT_LOCALE = 'en';

// "fr", "FR", "fr-CA" -> "fr"; anything unsupported or malformed -> "en".
// Object.hasOwn stops values like "constructor" or "__proto__" matching.
function resolveLocale(lang) {
  if (typeof lang !== 'string') return DEFAULT_LOCALE;
  const code = lang.trim().toLowerCase().split('-')[0];
  return Object.hasOwn(LOCALES, code) ? code : DEFAULT_LOCALE;
}

function getMessages(locale) {
  return LOCALES[resolveLocale(locale)];
}

function formatToday(locale, date = new Date()) {
  return new Intl.DateTimeFormat(getMessages(locale).intlLocale, { dateStyle: 'full' }).format(date);
}

function supportedLocales() {
  return Object.entries(LOCALES).map(([code, messages]) => ({ code, name: messages.languageName }));
}

module.exports = { resolveLocale, getMessages, formatToday, supportedLocales, DEFAULT_LOCALE };
