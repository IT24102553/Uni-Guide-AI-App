const jwt = require("jsonwebtoken");

const DEFAULT_JWT_EXPIRES_IN = "7d";

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getJwtSecret() {
  return getRequiredEnv("JWT_SECRET");
}

function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN?.trim() || DEFAULT_JWT_EXPIRES_IN;
}

function createAuthToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      role: user.role,
    },
    getJwtSecret(),
    {
      expiresIn: getJwtExpiresIn(),
    }
  );
}

function verifyAuthToken(token) {
  return jwt.verify(token, getJwtSecret());
}

module.exports = {
  createAuthToken,
  getJwtExpiresIn,
  verifyAuthToken,
};
