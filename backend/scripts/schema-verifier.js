const fs = require('node:fs');
const path = require('node:path');
const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../database/schema/full-schema.json'), 'utf8'));
const normalize = value => String(value ?? '').toLowerCase().replace(/[`()\s]/g, '');

async function verifySchema(connection, tables = Object.keys(manifest)) {
  const errors = [];
  for (const table of tables) {
    const spec = manifest[table];
    if (!spec) throw new Error('Unsupported schema table');
    const [columns] = await connection.query('SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type, IS_NULLABLE AS nullable, COLUMN_DEFAULT AS default_value, EXTRA AS extra FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?', [table]);
    for (const [name, expected] of Object.entries(spec.columns)) {
      const actual = columns.find(column => column.name === name);
      if (!actual || normalize(actual.type) !== normalize(expected.type) || (actual.nullable === 'YES') !== expected.nullable || normalize(actual.default_value) !== normalize(expected.default) || String(actual.extra).includes('auto_increment') !== expected.auto || String(actual.extra).toLowerCase().includes('on update') !== expected.update) errors.push(`${table}.${name}: column drift`);
    }
    if (columns.length !== Object.keys(spec.columns).length) errors.push(`${table}: unexpected column count`);
    const [indexes] = await connection.query('SELECT INDEX_NAME AS name, COLUMN_NAME AS column_name, NON_UNIQUE AS non_unique, SEQ_IN_INDEX AS sequence FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? ORDER BY SEQ_IN_INDEX', [table]);
    for (const [name, expected] of Object.entries(spec.indexes)) {
      const actual = indexes.filter(index => index.name === name);
      if (actual.map(index => index.column_name).join(',') !== expected.columns.join(',') || !actual.length || (Number(actual[0].non_unique) === 0) !== expected.unique) errors.push(`${table}.${name}: index drift`);
    }
    const [foreign] = await connection.query('SELECT k.CONSTRAINT_NAME AS name, k.COLUMN_NAME AS column_name, k.REFERENCED_TABLE_NAME AS target_table, k.REFERENCED_COLUMN_NAME AS target_column, r.UPDATE_RULE AS update_rule, r.DELETE_RULE AS delete_rule FROM information_schema.key_column_usage k JOIN information_schema.referential_constraints r ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND r.TABLE_NAME = k.TABLE_NAME WHERE k.CONSTRAINT_SCHEMA = DATABASE() AND k.TABLE_NAME = ?', [table]);
    for (const expected of spec.foreign) if (!foreign.some(actual => actual.name === expected.name && actual.column_name === expected.column && actual.target_table === expected.table && actual.target_column === expected.target && actual.update_rule === expected.update && actual.delete_rule === expected.delete)) errors.push(`${table}.${expected.name}: foreign key drift`);
    const [checks] = await connection.query('SELECT c.CONSTRAINT_NAME AS name, c.CHECK_CLAUSE AS clause, t.ENFORCED AS enforced FROM information_schema.check_constraints c JOIN information_schema.table_constraints t ON t.CONSTRAINT_SCHEMA = c.CONSTRAINT_SCHEMA AND t.CONSTRAINT_NAME = c.CONSTRAINT_NAME WHERE t.CONSTRAINT_SCHEMA = DATABASE() AND t.TABLE_NAME = ?', [table]);
    for (const [name, expression] of Object.entries(spec.checks)) if (!checks.some(actual => actual.name === name && normalize(actual.clause) === normalize(expression) && actual.enforced === 'YES')) errors.push(`${table}.${name}: check constraint drift`);
  }
  return errors;
}
module.exports = { verifySchema, manifest };
