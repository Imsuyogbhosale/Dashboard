const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validPhoneNumber(phoneNumber) {
  return typeof phoneNumber === 'string' && /^\+[1-9]\d{7,14}$/.test(phoneNumber);
}

function getJwtSecret() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set to a random value of at least 32 characters');
  }
  return process.env.JWT_SECRET;
}

async function register({ email, phoneNumber, password }) {
  if (!validEmail(email) || !validPhoneNumber(phoneNumber) ||
      typeof password !== 'string' || password.length < 12 ||
      Buffer.byteLength(password, 'utf8') > 72) {
    throw createHttpError(400, 'Provide a valid email, phone number in E.164 format, and password of 12-72 characters.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query('BEGIN');
    transactionOpen = true;
    const result = await client.query(
      `INSERT INTO users (email, phone_number, role, password_hash)
       VALUES (LOWER($1), $2, 'user', $3)
       RETURNING id, email, phone_number, role, phone_verified`,
      [email, phoneNumber, passwordHash],
    );
    await client.query(
      'INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
      [result.rows[0].id],
    );
    await client.query('COMMIT');
    transactionOpen = false;
    return { user: result.rows[0] };
  } catch (error) {
    if (transactionOpen) await client.query('ROLLBACK');
    if (error.code === '23505') {
      throw createHttpError(409, 'An account with that email or phone number already exists.');
    }
    throw error;
  } finally {
    client.release();
  }
}

async function login({ email, password }) {
  if (!validEmail(email) || typeof password !== 'string') {
    throw createHttpError(400, 'Provide a valid email and password.');
  }

  const result = await pool.query(
    'SELECT id, email, phone_number, role, password_hash FROM users WHERE email = LOWER($1)',
    [email],
  );
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw createHttpError(401, 'Invalid email or password.');
  }
  const token = jwt.sign(
    { sub: String(user.id), role: user.role },
    getJwtSecret(),
    { expiresIn: '1h', issuer: 'dashboard-api', audience: 'dashboard-client' },
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      phoneNumber: user.phone_number,
      role: user.role,
    },
  };
}

module.exports = { register, login };
