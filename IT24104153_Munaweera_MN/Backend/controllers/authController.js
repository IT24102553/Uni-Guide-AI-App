const authService = require('../services/authService');

function sendError(res, error, fallbackMessage) {
  res.status(error.statusCode || 500).json({
    message: error.message || fallbackMessage,
  });
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);

    res.status(200).json({
      message: 'Login successful',
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    sendError(res, error, 'Error during login');
  }
}

function getDemoAccount(req, res) {
  res.status(200).json({
    email: process.env.DEMO_STUDENT_EMAIL?.trim() || 'it24104153@my.sliit.lk',
    password: process.env.DEMO_STUDENT_PASSWORD?.trim() || 'Student@123',
  });
}

module.exports = {
  login,
  getDemoAccount,
};
