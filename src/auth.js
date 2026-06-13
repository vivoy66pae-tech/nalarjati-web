import { config } from './config.js';

export function basicAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) {
    res.setHeader('WWW-Authenticate', 'Basic realm="nalarjati admin"');
    return res.status(401).send('Auth required');
  }
  const [type, creds] = auth.split(' ');
  if (type !== 'Basic') return res.status(401).send('Bad auth');
  const [user, pass] = Buffer.from(creds, 'base64').toString().split(':');
  if (user === config.admin.user && pass === config.admin.pass) {
    req.user = user;
    return next();
  }
  res.setHeader('WWW-Authenticate', 'Basic realm="nalarjati admin"');
  return res.status(401).send('Wrong creds');
}
