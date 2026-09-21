// Dev proxy for the CP4BA validation build: engine calls go to the BAW route (with its URL prefix), Zen calls to the cpd route.
//   CP4BA_BAW=https://<cpd or baw route host>  CP4BA_PREFIX=/bas  CP4BA_CPD=https://<cpd route host>
//   npm run start:cp4ba
// The portal authenticates with the Zen identity token (Authorization: Bearer) on every call. Cookies must NOT reach the browser:
// the Zen sign-on answer sets platform session cookies, and the Workflow server's CSRF filter blocks any cookie-bearing request
// that carries no BPMCSRFToken ("This request was blocked during CSRF Filtering!"), including the token request itself.
// A production reverse proxy needs the same: strip Set-Cookie from the upstream answers (nginx: proxy_hide_header Set-Cookie).
const baw = (process.env.CP4BA_BAW || 'https://localhost').replace(/\/$/, '');
const prefix = process.env.CP4BA_PREFIX || '';
const cpd = (process.env.CP4BA_CPD || baw).replace(/\/$/, '');
// Also drop the browser's Origin / Referer: the Workflow server's CSRF filter treats the dev-server origin as cross-site and answers
// 403 "blocked during CSRF Filtering" even without cookies. (nginx: proxy_set_header Origin ""; proxy_set_header Referer "";)
const noCookies = { configure: (proxy) => { proxy.on('proxyRes', (proxyRes) => { delete proxyRes.headers['set-cookie']; }); proxy.on('proxyReq', (proxyReq) => { proxyReq.removeHeader('origin'); proxyReq.removeHeader('referer'); }); },
  onProxyRes: (proxyRes) => { delete proxyRes.headers['set-cookie']; }, onProxyReq: (proxyReq) => { proxyReq.removeHeader('origin'); proxyReq.removeHeader('referer'); } };   // Vite (Angular >= 17) uses configure, webpack used onProxyRes/onProxyReq
const engine = { target: baw, secure: false, changeOrigin: true, logLevel: 'warn', pathRewrite: prefix ? { '^/': prefix + '/' } : undefined, ...noCookies };
module.exports = {
  '/rest': engine, '/bpm': engine, '/ops': engine, '/teamworks': engine,
  '/zen': { target: cpd, secure: false, changeOrigin: true, logLevel: 'warn', pathRewrite: { '^/zen': '' }, ...noCookies },
};
