const jwt = require('jsonwebtoken');
const pool = require('../config/database');

function unauthorized(res, message = 'Authentication required.') {
  return res.status(401).json({ error: message });
}

async function authenticate(req, res, next) {
  const authorization = req.get('authorization');
  const match = authorization && authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return unauthorized(res);
  }

  let claims;
  try {
    claims = jwt.verify(match[1], process.env.JWT_SECRET, {
      issuer: 'dashboard-api',
      audience: 'dashboard-client',
    });
  } catch {
    return unauthorized(res, 'Invalid or expired token.');
  }

  if (!claims || typeof claims === 'string' || typeof claims.sub !== 'string') {
    return unauthorized(res, 'Invalid or expired token.');
  }

  try {
    const result = await pool.query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [claims.sub],
    );
    if (!result.rows[0]) {
      return unauthorized(res, 'User account not found.');
    }
    req.user = result.rows[0];
    next();
  } catch (error) {
    next(error);
  }
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to access this resource.' });
    }
    next();
  };
}

module.exports = { authenticate, authorizeRoles };
