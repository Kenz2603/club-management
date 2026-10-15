const express = require('express');
const path = require('path');
const clubsRouter = require('./routes/clubs');

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

app.use('/api/clubs', clubsRouter);

module.exports = app;
