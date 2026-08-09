type VercelRequest = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): VercelResponse;
  json(value: unknown): void;
  send(value: Buffer): void;
};

const DRIVE_FILE_ID = /^[a-zA-Z0-9_-]{10,100}$/;
const MAX_PREVIEW_BYTES = 12 * 1024 * 1024;

function fail(response: VercelResponse, status: number, error: string) {
  response.setHeader('Cache-Control', 'no-store');
  return response.status(status).json({ ok: false, error });
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return fail(response, 405, 'Method not allowed.');
  }

  const rawId = Array.isArray(request.query.id) ? request.query.id[0] : request.query.id;
  const fileId = String(rawId || '').trim();
  if (!DRIVE_FILE_ID.test(fileId)) {
    return fail(response, 400, 'Invalid report preview.');
  }

  try {
    const upstream = await fetch(
      `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`,
      {
        redirect: 'follow',
        headers: { Accept: 'image/png,image/*;q=0.8' },
        signal: AbortSignal.timeout(15000),
      },
    );
    const contentType = upstream.headers.get('content-type') || '';
    const declaredLength = Number(upstream.headers.get('content-length') || 0);

    if (!upstream.ok || !contentType.toLowerCase().startsWith('image/')) {
      return fail(response, 404, 'Report preview is unavailable.');
    }
    if (declaredLength > MAX_PREVIEW_BYTES) {
      return fail(response, 413, 'Report preview is too large.');
    }

    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (bytes.length > MAX_PREVIEW_BYTES) {
      return fail(response, 413, 'Report preview is too large.');
    }

    response.setHeader('Content-Type', contentType);
    response.setHeader('Content-Length', String(bytes.length));
    response.setHeader('Content-Disposition', 'inline');
    response.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    return response.status(200).send(bytes);
  } catch (error) {
    console.error('Lumen preview proxy failed.', error);
    return fail(response, 502, 'Report preview could not be loaded.');
  }
}
