const express = require('express');
const pool = require('../config/database');

const router = express.Router();

const demoProfile = {
  name: 'Demo User',
  email: 'demo@example.com',
  phoneNumber: '+15555550123',
  profilePhoto: null,
  address: 'Demo Address',
  department: 'Engineering',
  designation: 'Developer',
  bio: 'This is sample profile data for local API testing.',
};

const editableFields = new Set(Object.keys(demoProfile));
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+[1-9]\d{7,14}$/;

function isLocalRequest(req) {
  const remoteAddress = req.socket.remoteAddress;
  return remoteAddress === '127.0.0.1' ||
    remoteAddress === '::1' ||
    remoteAddress === '::ffff:127.0.0.1';
}

function requireLocalTestMode(req, res, next) {
  if (process.env.PROFILE_TEST_API !== 'true' || process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found.' });
  }
  if (!isLocalRequest(req)) {
    return res.status(403).json({ error: 'This test API is available only from this computer.' });
  }
  next();
}

function validateInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return 'Provide profile fields as a JSON object.';
  }
  if (!Object.keys(input).length) {
    return 'Provide at least one profile field.';
  }

  for (const [field, value] of Object.entries(input)) {
    if (!editableFields.has(field)) return `Unsupported profile field: ${field}.`;
    if (typeof value !== 'string' && value !== null) return `${field} must be a string or null.`;
    if (typeof value === 'string') {
      const maxLength = field === 'bio' || field === 'address' ? 2000 : 254;
      if (value.length > maxLength) return `${field} must be no longer than ${maxLength} characters.`;
    }
    if (field === 'email' && typeof value === 'string' && !emailPattern.test(value)) {
      return 'Provide a valid email address.';
    }
    if (field === 'phoneNumber' && typeof value === 'string' && !phonePattern.test(value)) {
      return 'Provide a phone number in E.164 format.';
    }
    if (field === 'profilePhoto' && typeof value === 'string') {
      try {
        const url = new URL(value);
        if (url.protocol !== 'https:') return 'profilePhoto must be an HTTPS URL or null.';
      } catch {
        return 'profilePhoto must be a valid HTTPS URL or null.';
      }
    }
  }
  return null;
}

router.use(requireLocalTestMode);

router.get('/', (req, res) => {
  res.json({ profile: { ...demoProfile } });
});

router.post('/', (req, res) => {
  const validationError = validateInput(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  Object.assign(demoProfile, req.body);
  res.status(201).json({ profile: { ...demoProfile } });
});

router.patch('/', (req, res) => {
  const validationError = validateInput(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  Object.assign(demoProfile, req.body);
  res.json({ profile: { ...demoProfile } });
});

router.post('/db', async (req, res, next) => {
  const validationError = validateInput(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  for (const field of ['name', 'email', 'phoneNumber']) {
    if (typeof req.body[field] !== 'string' || !req.body[field].trim()) {
      return res.status(400).json({ error: `${field} is required.` });
    }
  }

  try {
    const {
      name,
      email,
      phoneNumber,
      profilePhoto = null,
      address = null,
      department = null,
      designation = null,
      bio = null,
    } = req.body;
    const result = await pool.query(
      `INSERT INTO standalone_profiles
        (name, email, phone_number, profile_photo, address, department, designation, bio)
       VALUES ($1, LOWER($2), $3, $4, $5, $6, $7, $8)
       RETURNING id, name, email, phone_number, profile_photo, address,
                 department, designation, bio, created_at`,
      [name.trim(), email.trim(), phoneNumber.trim(), profilePhoto, address, department, designation, bio],
    );
    const row = result.rows[0];
    res.status(201).json({
      profile: {
        id: row.id,
        name: row.name,
        email: row.email,
        phoneNumber: row.phone_number,
        profilePhoto: row.profile_photo,
        address: row.address,
        department: row.department,
        designation: row.designation,
        bio: row.bio,
        createdAt: row.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/db/:profileId', async (req, res, next) => {
  if (!/^[1-9]\d{0,18}$/.test(req.params.profileId) ||
      BigInt(req.params.profileId) > 9223372036854775807n) {
    return res.status(400).json({ error: 'Profile ID must be a positive integer.' });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, email, phone_number, profile_photo, address,
              department, designation, bio, created_at
       FROM standalone_profiles
       WHERE id = $1`,
      [req.params.profileId],
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'Profile not found.' });
    res.json({
      profile: {
        id: row.id,
        name: row.name,
        email: row.email,
        phoneNumber: row.phone_number,
        profilePhoto: row.profile_photo,
        address: row.address,
        department: row.department,
        designation: row.designation,
        bio: row.bio,
        createdAt: row.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
