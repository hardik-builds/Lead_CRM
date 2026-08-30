import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'leadpulse_secure_jwt_token_secret_987654321';

export function authenticateAdminCredentials(email, password) {
  const inputEmail = (email || '').trim().toLowerCase();
  const inputPassword = password || '';

  const adminEmail = (process.env.CRM_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = process.env.CRM_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '';

  const internEmail = (process.env.CRM_INTERN_EMAIL || process.env.INTERN_EMAIL || '').trim().toLowerCase();
  const internPassword = process.env.CRM_INTERN_PASSWORD || process.env.INTERN_PASSWORD || '';

  let role = null;
  let userEmail = '';

  if (adminEmail && adminPassword && inputEmail === adminEmail && inputPassword === adminPassword) {
    role = 'Admin (You)';
    userEmail = inputEmail;
  } else if (internEmail && internPassword && inputEmail === internEmail && inputPassword === internPassword) {
    role = 'Intern';
    userEmail = inputEmail;
  }

  if (role) {
    const token = jwt.sign(
      { email: userEmail, role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    return { success: true, token, email: userEmail, role };
  }

  return { success: false, error: 'Invalid email or password' };
}

export function verifyRequestAuth(req) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) return { valid: false, error: 'No authorization token provided' };

    // Try primary secret, fallback to default secret if JWT_SECRET changed in .env.local
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      return { valid: true, decoded };
    } catch (e1) {
      const fallbackSecret = 'leadpulse_secure_jwt_token_secret_987654321';
      const decoded = jwt.verify(token, fallbackSecret);
      return { valid: true, decoded };
    }
  } catch (err) {
    return { valid: false, error: 'Invalid or expired token' };
  }
}
