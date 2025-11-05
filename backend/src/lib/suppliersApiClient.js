const DEFAULT_BASE_URL =
  process.env.SUPPLIERS_SERVICE_URL || 'http://localhost:4000/api/suppliers';
const parsedTimeout = parseInt(process.env.SUPPLIERS_SERVICE_TIMEOUT ?? '5000', 10);
const DEFAULT_TIMEOUT = Number.isNaN(parsedTimeout) ? 5000 : parsedTimeout;

let axiosModule;

try {
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  axiosModule = require('axios');
} catch (error) {
  axiosModule = null;
}

const buildUrl = (baseURL, path, params = {}) => {
  const url = new URL(path, baseURL.endsWith('/') ? baseURL : `${baseURL}/`);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    url.searchParams.append(key, value);
  });
  return url;
};

const normalizeHeaders = (headers = {}) => {
  if (!headers) return {};
  return Object.entries(headers).reduce((acc, [key, value]) => {
    if (value === undefined) return acc;
    acc[key] = value;
    return acc;
  }, {});
};

const createFetchAdapter = (baseURL, timeout) => {
  const request = async (method, path, config = {}) => {
    const { data, params, headers } = config;
    const url = buildUrl(baseURL, path, params);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const normalizedHeaders = {
      'Content-Type': 'application/json',
      ...normalizeHeaders(headers),
    };

    const requestInit = {
      method,
      headers: normalizedHeaders,
      signal: controller.signal,
    };

    if (data !== undefined && data !== null && method !== 'GET') {
      requestInit.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, requestInit);
      const rawBody = await response.text();
      clearTimeout(timeoutId);

      let parsedBody = rawBody;
      if (rawBody) {
        try {
          parsedBody = JSON.parse(rawBody);
        } catch (_err) {
          parsedBody = rawBody;
        }
      } else {
        parsedBody = null;
      }

      if (!response.ok) {
        const error = new Error('Request to suppliers service failed');
        error.isAxiosError = true;
        error.response = {
          status: response.status,
          data: parsedBody,
          headers: Object.fromEntries(response.headers.entries()),
        };
        error.request = {
          url: url.toString(),
          method,
          headers: normalizedHeaders,
        };
        throw error;
      }

      return {
        data: parsedBody,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        const timeoutError = new Error('Suppliers service request timed out');
        timeoutError.isAxiosError = true;
        timeoutError.code = 'ECONNABORTED';
        timeoutError.request = {
          url: url.toString(),
          method,
          headers: normalizedHeaders,
        };
        throw timeoutError;
      }

      if (!error.isAxiosError) {
        error.isAxiosError = true;
        error.request = {
          url: url.toString(),
          method,
          headers: normalizedHeaders,
        };
      }

      throw error;
    }
  };

  return {
    get: (path, config) => request('GET', path, config),
    delete: (path, config) => request('DELETE', path, config),
    post: (path, data, config) => request('POST', path, { ...config, data }),
    put: (path, data, config) => request('PUT', path, { ...config, data }),
  };
};

const client =
  axiosModule && typeof axiosModule.create === 'function'
    ? axiosModule.create({
        baseURL: DEFAULT_BASE_URL,
        timeout: DEFAULT_TIMEOUT,
      })
    : createFetchAdapter(DEFAULT_BASE_URL, DEFAULT_TIMEOUT);

const isAxiosError =
  axiosModule && typeof axiosModule.isAxiosError === 'function'
    ? axiosModule.isAxiosError.bind(axiosModule)
    : (error) => Boolean(error?.isAxiosError);

module.exports = { client, isAxiosError };
