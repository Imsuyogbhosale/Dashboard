const authService = require('../services/authService');

async function register(req, res, next) {
  try {
    const { email, phoneNumber, password } = req.body || {};
    const result = await authService.register({ email, phoneNumber, password });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    const result = await authService.login({ email, password });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = { register, login };
