const readline = require('node:readline');
const pool = require('../src/config/database');
const { hashPassword } = require('../src/utils/password');

function parseArgs(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
      parsed[key] = value;
    }
  }
  return parsed;
}

function promptHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const wasRaw = process.stdin.isRaw;
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();

    let password = '';
    const onData = (chunk) => {
      const str = chunk.toString('utf8');
      for (const char of str) {
        if (char === '\n' || char === '\r' || char === '\u0004') {
          if (process.stdin.setRawMode) {
            process.stdin.setRawMode(wasRaw);
          }
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(password);
          return;
        }
        if (char === '\u0003') {
          process.exit(1);
        }
        if (char === '\u007f' || char === '\b') {
          if (password.length > 0) {
            password = password.slice(0, -1);
          }
        } else {
          password += char;
        }
      }
    };

    process.stdin.on('data', onData);
  });
}

async function getPassword() {
  if (process.env.ADMIN_PASSWORD) {
    const pwd = process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_PASSWORD;
    return pwd;
  }

  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8').replace(/[\r\n]+$/, '');
  }

  return promptHidden('Enter admin password (min 8 chars): ');
}

async function main(customArgs, customPool = pool) {
  const args = customArgs || parseArgs(process.argv.slice(2));

  if (args.password) {
    process.stderr.write('Security Error: Passing password via --password CLI argument is prohibited. Use interactive prompt, STDIN, or ADMIN_PASSWORD env.\n');
    return 1;
  }

  const username = args.username || (process.stdin.isTTY ? await promptText('Enter username (3-50 chars): ') : null);
  const email = args.email || (process.stdin.isTTY ? await promptText('Enter email: ') : null);
  const fullName = args.name || (process.stdin.isTTY ? await promptText('Enter full name: ') : null);

  if (!username || !email || !fullName) {
    process.stderr.write('Usage: node backend/scripts/create-admin.js --username <user> --email <email> --name <fullName>\n');
    return 1;
  }

  if (!/^[a-zA-Z0-9_-]{3,50}$/.test(username)) {
    process.stderr.write('Validation Error: Username must be 3-50 alphanumeric characters, hyphens or underscores.\n');
    return 1;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    process.stderr.write('Validation Error: Invalid email format.\n');
    return 1;
  }

  const password = await getPassword();
  if (!password || password.length < 8) {
    process.stderr.write('Validation Error: Password must have at least 8 characters.\n');
    return 1;
  }

  let connection = null;
  try {
    connection = await customPool.getConnection();
    const [existing] = await connection.query(
      'SELECT id, username, email FROM users WHERE username = ? OR email = ? LIMIT 1',
      [username, email]
    );

    if (existing.length > 0) {
      process.stderr.write(`Conflict Error: User with username '${username}' or email '${email}' already exists. Aborting without overwrite.\n`);
      return 1;
    }

    const hashedPassword = await hashPassword(password);

    await connection.query(
      `INSERT INTO users (username, email, password_hash, full_name, role, status)
       VALUES (?, ?, ?, ?, 'admin', 'active')`,
      [username, email, hashedPassword, fullName]
    );

    process.stdout.write(`Successfully created admin user: ${username} (${email})\n`);
    return 0;
  } catch (err) {
    process.stderr.write(`Database Error: ${err.message}\n`);
    return 1;
  } finally {
    if (connection) {
      connection.release();
    }
    await customPool.end();
  }
}

function promptText(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

if (require.main === module) {
  main().then((code) => {
    if (code !== 0) {
      process.exit(code);
    }
  });
}

module.exports = { main, parseArgs };
