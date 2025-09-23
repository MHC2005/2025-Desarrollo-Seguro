import jwt from 'jsonwebtoken';

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required but not set');
  }
  return secret;
};

const generateToken = (userId: string) => {
  return jwt.sign(
    { id: userId }, 
    getJwtSecret(), 
    { expiresIn: '1h' }
  );
};

const verifyToken = (token: string) => {
  return jwt.verify(token, getJwtSecret());
};

export default {
  generateToken,
  verifyToken
}