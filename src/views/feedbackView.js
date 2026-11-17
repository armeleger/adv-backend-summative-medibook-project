// HTML for the feedback page. All text comes from the locale files and every
// dynamic value is HTML-escaped.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ESCAPES[char]);

const STYLES = `
  body { font-family: system-ui, sans-serif; max-width: 760px; margin: 0 auto; padding: 24px 16px; color: #1f2933; background: #f7f9fb; }
  header { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 8px; }
  h1 { margin: 0 0 4px; color: #0b5c7a; }
  nav a { margin-left: 8px; color: #0b5c7a; }
  nav a[aria-current="true"] { font-weight: bold; text-decoration: none; }
  .date { color: #52606d; margin: 0 0 16px; }
  .error { background: #fde8e8; border: 1px solid #f5a3a3; padding: 10px 12px; border-radius: 6px; }
  label { display: block; font-weight: 600; margin: 20px 0 6px; }
  textarea { width: 100%; box-sizing: border-box; min-height: 110px; padding: 10px; font: inherit; border: 1px solid #cbd2d9; border-radius: 6px; }
  button { margin-top: 20px; padding: 10px 20px; font: inherit; background: #0b5c7a; color: #fff; border: 0; border-radius: 6px; cursor: pointer; }
`;

function layout({ locale, messages, today, languages }, body) {
  const links = languages
    .map(({ code, name }) => `<a href="/feedback?lang=${code}" hreflang="${code}"${code === locale ? ' aria-current="true"' : ''}>${escapeHtml(name)}</a>`)
    .join('');
  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(messages.title)}</title>
  <style>${STYLES}</style>
</head>
<body>
  <header>
    <h1>${escapeHtml(messages.title)}</h1>
    <nav aria-label="${escapeHtml(messages.languageLabel)}">${escapeHtml(messages.languageLabel)}: ${links}</nav>
  </header>
  <p class="date">${escapeHtml(messages.dateLabel)}: <time>${escapeHtml(today)}</time></p>
  ${body}
</body>
</html>`;
}

function renderFeedbackForm(context) {
  const { locale, messages, answers = [], error } = context;
  const questions = messages.questions
    .map((question, i) => `
    <label for="answer${i + 1}">${i + 1}. ${escapeHtml(question)}</label>
    <textarea id="answer${i + 1}" name="answer${i + 1}" required>${escapeHtml(answers[i] ?? '')}</textarea>`)
    .join('');

  return layout(context, `
  <p>${escapeHtml(messages.instructions)}</p>
  ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}
  <form method="post" action="/feedback?lang=${locale}">
    ${questions}
    <button type="submit">${escapeHtml(messages.submit)}</button>
  </form>`);
}

function renderThankYou(context) {
  const { locale, messages } = context;
  return layout(context, `
  <h2>${escapeHtml(messages.thankYouTitle)}</h2>
  <p>${escapeHtml(messages.thankYouMessage)}</p>
  <p><a href="/feedback?lang=${locale}">${escapeHtml(messages.backLink)}</a></p>`);
}

module.exports = { renderFeedbackForm, renderThankYou, escapeHtml };
