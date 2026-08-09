import { createHash } from 'node:crypto';

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
  body?: unknown;
  socket: { remoteAddress?: string };
};

type VercelResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): VercelResponse;
  json(value: unknown): void;
  send(value: string): void;
};

export const config = { maxDuration: 300 };

const endpoint = (process.env.LUMEN_APPS_SCRIPT_URL || '').trim();
const backendSecret = (process.env.LUMEN_BACKEND_SECRET || '').trim();

function clientKey(request: VercelRequest) {
  const forwarded = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const source = forwarded || request.socket.remoteAddress || 'unknown';
  return createHash('sha256').update(source).digest('hex');
}

function fail(response: VercelResponse, status: number, error: string) {
  return response.status(status).json({ ok: false, error });
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (!endpoint || !backendSecret) {
    return fail(response, 503, 'Lumen is not connected to its scanner yet.');
  }

  try {
    if (request.method === 'GET') {
      const action = String(request.query.action || 'status');
      const scanId = String(request.query.scanId || '');
      if (action !== 'status' || !/^[a-zA-Z0-9-]{8,80}$/.test(scanId)) {
        return fail(response, 400, 'Invalid scan status request.');
      }
      const upstream = await fetch(endpoint, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'status', scanId, secret: backendSecret }),
        signal: AbortSignal.timeout(15000),
      });
      const text = await upstream.text();
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      return response.status(upstream.ok ? 200 : 502).send(text);
    }

    if (request.method !== 'POST') {
      response.setHeader('Allow', 'GET, POST');
      return fail(response, 405, 'Method not allowed.');
    }

    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    if (body?.action !== 'scan' || !/^[a-zA-Z0-9-]{8,80}$/.test(String(body.scanId || ''))) {
      return fail(response, 400, 'Invalid scan request.');
    }

    const upstream = await fetch(endpoint, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'scan',
        scanId: String(body.scanId),
        url: String(body.url || ''),
        clientKey: clientKey(request),
        secret: backendSecret,
      }),
      signal: AbortSignal.timeout(290000),
    });
    const text = await upstream.text();
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    return response.status(upstream.ok ? 200 : 502).send(text);
  } catch (error) {
    console.error('Lumen upstream request failed.', error);
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? 'The scan took too long. Please try again in a few minutes.'
      : 'Lumen could not reach the scanner. Please try again.';
    return fail(response, 502, message);
  }
}
