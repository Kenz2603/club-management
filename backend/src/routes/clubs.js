const express = require('express');
const pool = require('../config/database');

const legacyResponse = require('../utils/legacy-response');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [clubs] = await pool.execute(
      'SELECT id, name, description, founded_date, status, created_at, updated_at FROM clubs ORDER BY id DESC'
    );

    res.status(200).json({
      success: true,
      data: clubs.map(legacyResponse)
    });
  } catch (error) {
    process.stderr.write(`Failed to fetch clubs: ${error.message}\n`);

    res.status(500).json({
      success: false,
      message: 'Unable to fetch clubs'
    });
  }
});

module.exports = router;
