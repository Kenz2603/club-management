const pool = require('../config/database');

async function transaction(work) {
  const connection = await pool.getConnection();
  let failed = false;
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    failed = true;
    try {
      await connection.rollback();
    } catch {}
    throw error;
  } finally {
    try {
      connection.release();
    } catch (error) {
      if (!failed) throw error;
    }
  }
}

module.exports = transaction;
