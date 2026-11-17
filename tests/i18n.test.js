const { resolveLocale, getMessages, formatToday } = require('../src/utils/i18n');
const { renderFeedbackForm, escapeHtml } = require('../src/views/feedbackView');

describe('resolveLocale', () => {
  test.each([
    [undefined, 'en'],
    ['fr', 'fr'],
    ['FR', 'fr'],
    ['fr-CA', 'fr'],
    ['de', 'en'],
    ['__proto__', 'en'],
    ['constructor', 'en'],
    [['fr', 'en'], 'en'], // ?lang=fr&lang=en arrives as an array
  ])('%p -> %p', (input, expected) => {
    expect(resolveLocale(input)).toBe(expected);
  });
});

describe('locale files', () => {
  test('every locale has a title, instructions and exactly 5 questions', () => {
    for (const locale of ['en', 'fr']) {
      const messages = getMessages(locale);
      expect(messages.title).toEqual(expect.any(String));
      expect(messages.instructions).toEqual(expect.any(String));
      expect(messages.questions).toHaveLength(5);
    }
  });

  test('formats the date for the active locale', () => {
    const date = new Date(2026, 10, 17);
    // Exact punctuation varies between ICU versions, so check the words.
    expect(formatToday('en', date)).toMatch(/Tuesday,? 17 November 2026/);
    expect(formatToday('fr', date)).toBe('mardi 17 novembre 2026');
  });
});

describe('feedback form', () => {
  test('renders 5 textareas in the requested language and escapes answers', () => {
    const html = renderFeedbackForm({
      locale: 'fr',
      messages: getMessages('fr'),
      today: 'mardi 17 novembre 2026',
      languages: [{ code: 'en', name: 'English' }, { code: 'fr', name: 'Français' }],
      answers: ['<script>alert(1)</script>'],
    });
    expect(html).toContain('<html lang="fr">');
    expect(html.match(/<textarea/g)).toHaveLength(5);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain(escapeHtml('<script>'));
  });
});
