const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(':memory:');

db.exec(`
  CREATE TABLE test (
    id INTEGER PRIMARY KEY,
    name TEXT
  );
`);

const insert = db.prepare('INSERT INTO test (name) VALUES (?)');
const result1 = insert.run('Alice');
console.log('Insert run result:', result1);

const query = db.prepare('SELECT * FROM test WHERE name = ?');
const row = query.get('Alice');
console.log('Query get result:', row);

const rows = db.prepare('SELECT * FROM test').all();
console.log('Query all result:', rows);
