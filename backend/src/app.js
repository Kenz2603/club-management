const express = require('express');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../../frontend')));

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    application: 'Club Management',
    message: 'Server is running'
  });
});

module.exports = app;
