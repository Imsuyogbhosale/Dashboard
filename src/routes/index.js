const express = require('express');
const healthRoutes = require('./healthRoutes');
const authRoutes = require('./authRoutes');
const adminRoutes = require('./adminRoutes');
const superadminRoutes = require('./superadminRoutes');
const profileRoutes = require('./profileRoutes');
const profileTestRoutes = require('./profileTestRoutes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/profile-test', profileTestRoutes);
router.use('/admin', adminRoutes);
router.use('/superadmin', superadminRoutes);

module.exports = router;
