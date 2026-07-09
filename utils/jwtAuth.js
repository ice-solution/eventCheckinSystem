const jwt = require('jsonwebtoken');

function getJwtSecret() {
  return process.env.JWT_SECRET || 'events';
}

function authenticateJwt(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ message: 'Unauthorized: missing Bearer token' });
  }

  const token = match[1];
  try {
    const payload = jwt.verify(token, getJwtSecret());
    req.jwt = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized: invalid token' });
  }
}

module.exports = {
  authenticateJwt,
  getJwtSecret,
};

