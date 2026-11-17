// Builds "col_a = ?, col_b = ?" for an UPDATE from already-validated fields.
// Column names come only from the model's fixed whitelist (never from the
// request), and every value is sent as a ? parameter.
function buildSetClause(fields, columnMap) {
  const entries = Object.entries(fields).filter(([key]) => Object.hasOwn(columnMap, key));
  return {
    clause: entries.map(([key]) => `${columnMap[key]} = ?`).join(', '),
    values: entries.map(([, value]) => value),
  };
}

module.exports = { buildSetClause };
