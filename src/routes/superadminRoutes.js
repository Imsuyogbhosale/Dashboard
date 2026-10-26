const express = require('express');
const { authenticate, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/dashboard', authenticate, authorizeRoles('superadmin'), (req, res) => {
  res.json({ message: 'Superadmin access granted.', user: req.user });
});

module.exports = router;
