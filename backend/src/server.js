const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  process.stdout.write(`Club Management running on port ${PORT}\n`);
});
