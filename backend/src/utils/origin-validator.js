function extractOriginFromReferer(referer) {
  if (!referer || typeof referer !== 'string') {
    return null;
  }
  try {
    const url = new URL(referer);
    return url.origin;
  } catch {
    return null;
  }
}

function isValidOrigin(req) {
  const originHeader = req.headers.origin;
  const refererHeader = req.headers.referer;
  const requestOrigin = originHeader || extractOriginFromReferer(refererHeader);

  if (!requestOrigin) {
    const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    if (isStateChanging) {
      if (req.headers.cookie && req.headers.cookie.includes('cm_session')) {
        return false;
      }
      if (process.env.NODE_ENV === 'production') {
        return false;
      }
    }
    return true;
  }

  const configuredOrigin = process.env.APP_ORIGIN;
  if (configuredOrigin) {
    return requestOrigin === configuredOrigin;
  }

  const host = req.headers.host;
  if (!host) {
    return false;
  }

  const proto = req.protocol || (req.secure ? 'https' : 'http');
  const expectedOrigin = `${proto}://${host}`;

  return requestOrigin === expectedOrigin;
}

module.exports = {
  isValidOrigin,
  extractOriginFromReferer
};
