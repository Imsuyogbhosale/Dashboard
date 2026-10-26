const crypto = require('crypto');
const {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const pool = require('../config/database');
const { getS3Client, getS3Config } = require('../config/s3');

const profileFields = {
  name: 'name',
  address: 'address',
  department: 'department',
  designation: 'designation',
  bio: 'bio',
  email: 'email',
  phoneNumber: 'phone_number',
};

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validateUserId(userId) {
  if (typeof userId !== 'string' && typeof userId !== 'number') {
    throw createHttpError(400, 'User ID must be a positive integer.');
  }
  if (!/^[1-9]\d{0,18}$/.test(String(userId)) ||
      BigInt(userId) > 9223372036854775807n) {
    throw createHttpError(400, 'User ID must be a positive integer.');
  }
}

function validateProfileInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw createHttpError(400, 'Provide profile fields as a JSON object.');
  }

  const unknownFields = Object.keys(input).filter((field) => !profileFields[field]);
  if (unknownFields.length) {
    throw createHttpError(400, `Unsupported profile field: ${unknownFields[0]}.`);
  }
  if (!Object.keys(input).length) {
    throw createHttpError(400, 'Provide at least one profile field to update.');
  }

  for (const [field, value] of Object.entries(input)) {
    if (typeof value !== 'string') {
      throw createHttpError(400, `${field} must be a string.`);
    }
    const maxLength = field === 'bio' || field === 'address' ? 2000 : field === 'email' ? 254 : 120;
    if (value.length > maxLength) {
      throw createHttpError(400, `${field} must be no longer than ${maxLength} characters.`);
    }
    if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw createHttpError(400, 'Provide a valid email address.');
    }
    if (field === 'phoneNumber' && !/^\+[1-9]\d{7,14}$/.test(value)) {
      throw createHttpError(400, 'Provide a phone number in E.164 format.');
    }
  }
}

function getImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return 'image/png';
  }
  if (buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  throw createHttpError(400, 'Uploaded file is not a valid JPEG, PNG, or WebP image.');
}

async function formatProfile(row) {
  if (!row) return null;
  let profilePhoto = null;
  if (row.photo_key) {
    const { bucket } = getS3Config();
    const client = getS3Client();
    profilePhoto = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: row.photo_key,
      }),
      { expiresIn: 900 },
    );
  }

  return {
    id: row.user_id,
    name: row.name ?? null,
    email: row.email,
    phoneNumber: row.phone_number,
    profilePhoto,
    address: row.address ?? null,
    department: row.department ?? null,
    designation: row.designation ?? null,
    bio: row.bio ?? null,
    role: row.role,
    updatedAt: row.updated_at ?? null,
  };
}

async function getProfile(userId) {
  validateUserId(userId);
  const result = await pool.query(
    `SELECT u.id AS user_id, u.email, u.phone_number, u.role,
            p.name, p.address, p.department, p.designation, p.bio, p.photo_key, p.updated_at
     FROM users u
     LEFT JOIN user_profiles p ON p.user_id = u.id
     WHERE u.id = $1`,
    [userId],
  );
  if (!result.rows[0]) throw createHttpError(404, 'User profile not found.');
  return formatProfile(result.rows[0]);
}

async function updateProfile(userId, input) {
  validateUserId(userId);
  validateProfileInput(input);
  const entries = Object.entries(input);
  const profileEntries = entries.filter(([field]) => !['email', 'phoneNumber'].includes(field));
  const userEntries = entries.filter(([field]) => ['email', 'phoneNumber'].includes(field));
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const existingUser = await client.query(
      'SELECT id FROM users WHERE id = $1 FOR UPDATE',
      [userId],
    );
    if (!existingUser.rows[0]) throw createHttpError(404, 'User profile not found.');

    const userValues = [];
    if (userEntries.length) {
      const assignments = userEntries.map(([field, value]) => {
        userValues.push(field === 'email' ? value.toLowerCase() : value);
        return `${profileFields[field]} = $${userValues.length}`;
      });
      userValues.push(userId);
      const result = await client.query(
        `UPDATE users SET ${assignments.join(', ')} WHERE id = $${userValues.length} RETURNING id`,
        userValues,
      );
      if (!result.rows[0]) throw createHttpError(404, 'User profile not found.');
    }

    await client.query(
      'INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
      [userId],
    );
    if (profileEntries.length) {
      const values = [userId];
      const assignments = profileEntries.map(([field, value]) => {
        values.push(value);
        return `${profileFields[field]} = $${values.length}`;
      });
      await client.query(
        `UPDATE user_profiles SET ${assignments.join(', ')}, updated_at = NOW()
         WHERE user_id = $1`,
        values,
      );
    } else {
      await client.query('UPDATE user_profiles SET updated_at = NOW() WHERE user_id = $1', [userId]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      throw createHttpError(409, 'That email address or phone number is already in use.');
    }
    throw error;
  } finally {
    client.release();
  }

  return getProfile(userId);
}

async function createProfile(userId, input) {
  return updateProfile(userId, input);
}

async function updateProfilePhoto(userId, file) {
  validateUserId(userId);
  if (!file) throw createHttpError(400, 'Attach an image using the "photo" form-data field.');

  const contentType = getImageType(file.buffer);
  if (contentType !== file.mimetype) {
    throw createHttpError(400, 'The uploaded image content does not match its declared file type.');
  }

  const user = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
  if (!user.rows[0]) throw createHttpError(404, 'User profile not found.');

  const previousPhoto = await pool.query(
    'SELECT photo_key FROM user_profiles WHERE user_id = $1',
    [userId],
  );
  const previousKey = previousPhoto.rows[0]?.photo_key;
  const { bucket } = getS3Config();
  const client = getS3Client();
  const key = `profile-photos/${userId}/${crypto.randomUUID()}`;
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: file.buffer,
    ContentType: contentType,
    ServerSideEncryption: 'AES256',
  }));

  try {
    await pool.query(
      `INSERT INTO user_profiles (user_id, photo_key)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE
       SET photo_key = EXCLUDED.photo_key, updated_at = NOW()`,
      [userId, key],
    );
  } catch (error) {
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch (cleanupError) {
      console.error('Failed to clean up an unlinked profile photo in S3:', cleanupError.message);
    }
    throw error;
  }

  if (previousKey) {
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: previousKey }));
    } catch (error) {
      console.error('Failed to remove the replaced profile photo from S3:', error.message);
    }
  }

  return getProfile(userId);
}

module.exports = { getProfile, createProfile, updateProfile, updateProfilePhoto };
