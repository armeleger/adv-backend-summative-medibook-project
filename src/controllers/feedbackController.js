// GET/POST /feedback - course feedback form in the requested language.
const { resolveLocale, getMessages, formatToday, supportedLocales } = require('../utils/i18n');
const { renderFeedbackForm, renderThankYou } = require('../views/feedbackView');

const QUESTION_COUNT = 5;

function pageContext(req) {
  const locale = resolveLocale(req.query.lang);
  return { locale, messages: getMessages(locale), today: formatToday(locale), languages: supportedLocales() };
}

// GET /feedback?lang=fr
function showForm(req, res) {
  res.type('html').send(renderFeedbackForm(pageContext(req)));
}

// POST /feedback?lang=fr  (form fields answer1..answer5)
function submitForm(req, res) {
  const context = pageContext(req);
  const answers = Array.from({ length: QUESTION_COUNT }, (_, i) => {
    const value = req.body?.[`answer${i + 1}`];
    return typeof value === 'string' ? value.trim() : '';
  });

  if (answers.some((answer) => answer.length === 0)) {
    return res.status(400).type('html').send(renderFeedbackForm({ ...context, answers, error: context.messages.requiredError }));
  }
  return res.type('html').send(renderThankYou(context));
}

module.exports = { showForm, submitForm };
