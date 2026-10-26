require('dotenv').config();

const port = process.env.PORT || 3000;

async function startServer() {
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('YOUR_PASSWORD')) {
    console.error('Set DATABASE_URL in a local .env file. Copy .env.example to .env and replace YOUR_PASSWORD with your PostgreSQL password.');
    process.exitCode = 1;
    return;
  }

  const pool = require('./config/database');
  const app = require('./app');
  const { syncConfiguredRoles } = require('./services/roleService');

  try {
    await pool.query('SELECT 1');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        phone_number TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL DEFAULT 'user',
        password_hash TEXT NOT NULL,
        phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        name TEXT,
        address TEXT,
        department TEXT,
        designation TEXT,
        bio TEXT,
        photo_key TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS standalone_profiles (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        profile_photo TEXT,
        address TEXT,
        department TEXT,
        designation TEXT,
        bio TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await syncConfiguredRoles();
    app.listen(port, () => {
      console.log(`Dashboard API listening on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to initialize PostgreSQL:', error.message);
    await pool.end();
    process.exitCode = 1;
  }
}

startServer();
