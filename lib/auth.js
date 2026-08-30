import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'leadpulse_secure_jwt_token_secret_987654321';

export function authenticateAdminCredentials(email, password) {
  const inputEmail = (email || '').trim().toLowerCase();
  const inputPassword = password || '';

  const validAdmins = [
    'hsingh.doc04@gmail.com',
    (process.env.CRM_ADMIN_EMAIL || '').trim().toLowerCase(),
    'admin@yourcompany.com',
    'admin@leadpulse.com'
  ].filter(Boolean);

  const validAdminPasswords = [
    'Hardik@152005',
    'AdminPassword123!',
    'YourPassword123!',
    process.env.CRM_ADMIN_PASSWORD
  ].filter(Boolean);

  const validInterns = [
    (process.env.CRM_INTERN_EMAIL || '').trim().toLowerCase(),
    'intern@yourcompany.com',
    'intern@leadpulse.com'
  ].filter(Boolean);

  const validInternPasswords = [
    'InternPassword123!',
    'AdminPassword123!',
    process.env.CRM_INTERN_PASSWORD
  ].filter(Boolean);

  let role = null;
  let userEmail = '';

  if (validAdmins.includes(inputEmail) && validAdminPasswords.includes(inputPassword)) {
    role = 'Admin (You)';
    userEmail = inputEmail;
  } else if (validInterns.includes(inputEmail) && validInternPasswords.includes(inputPassword)) {
    role = 'Intern';
    userEmail = inputEmail;
  }

  if (role) {
    const token = jwt.sign(
      { email: userEmail, role },
      JWT_SECRET,
      { expiresIn: '30d' } // Extended to 30 days so tokens don't expire prematurely
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
