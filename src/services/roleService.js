const pool = require('../config/database');

function getConfiguredEmails(variableName) {
  const emails = (process.env[variableName] || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (emails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new Error(`${variableName} must contain comma-separated valid email addresses.`);
  }

  return [...new Set(emails)];
}

async function syncConfiguredRoles() {
  const adminEmails = getConfiguredEmails('ADMIN_EMAILS');
  const superadminEmails = getConfiguredEmails('SUPERADMIN_EMAILS');
  const overlap = adminEmails.filter((email) => superadminEmails.includes(email));

  if (overlap.length) {
    throw new Error('An email cannot be listed in both ADMIN_EMAILS and SUPERADMIN_EMAILS.');
  }

  if (!adminEmails.length && !superadminEmails.length) {
    return;
  }

  const configuredEmails = [...adminEmails, ...superadminEmails];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE users
       SET role = 'user'
       WHERE role IN ('admin', 'superadmin')
         AND LOWER(email) <> ALL($1::text[])`,
      [configuredEmails],
    );
    if (adminEmails.length) {
      await client.query(
        `UPDATE users SET role = 'admin' WHERE LOWER(email) = ANY($1::text[])`,
        [adminEmails],
      );
    }
    if (superadminEmails.length) {
      await client.query(
        `UPDATE users SET role = 'superadmin' WHERE LOWER(email) = ANY($1::text[])`,
        [superadminEmails],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { syncConfiguredRoles };
