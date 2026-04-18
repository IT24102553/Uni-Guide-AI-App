const User = require('../models/User');
const appError = require('../utils/appError');
const { createAuthToken } = require('../utils/authToken');
const { verifyPasswordAndUpgrade } = require('../utils/passwords');

const EMAIL_PATTERN = /\S+@\S+\.\S+/;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function safeUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    studentProfile: user.studentProfile || null,
  };
}

function validateEmailOrThrow(email) {
  if (!email) {
    throw appError('Email is required', 400);
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw appError('Enter a valid email address', 400);
  }
}

async function login(email, password) {
  const normalizedEmail = normalizeEmail(email);

  validateEmailOrThrow(normalizedEmail);

  if (!password) {
    throw appError('Password is required', 400);
  }

  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw appError('User not found', 404);
  }

  if (user.status === 'inactive') {
    throw appError('Your account is inactive. Contact admin.', 403);
  }

  if (user.role !== 'student') {
    throw appError('This standalone module only supports student accounts.', 403);
  }

  const passwordMatches = await verifyPasswordAndUpgrade(user, password);

  if (!passwordMatches) {
    throw appError('Invalid password', 401);
  }

  return {
    token: createAuthToken(user),
    user: safeUser(user),
  };
}

module.exports = {
  login,
};
