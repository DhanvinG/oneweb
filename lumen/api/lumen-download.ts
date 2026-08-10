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
const MAX_PDF_BYTES = 30 * 1024 * 1024;

function fail(response: VercelResponse, status: number, error: string) {
  response.setHeader('Cache-Control', 'no-store');
  return response.status(status).json({ ok: false, error });
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  response.setHeader('Cache-Control', 'private, no-store');

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return fail(response, 405, 'Method not allowed.');
  }

  const rawId = Array.isArray(request.query.id) ? request.query.id[0] : request.query.id;
  const fileId = String(rawId || '').trim();
  if (!DRIVE_FILE_ID.test(fileId)) {
    return fail(response, 400, 'Invalid report download.');
  }

  try {
    const upstream = await fetch(
      `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`,
      {
        redirect: 'follow',
        headers: { Accept: 'application/pdf,application/octet-stream;q=0.8' },
        signal: AbortSignal.timeout(30000),
      },
    );
    const declaredLength = Number(upstream.headers.get('content-length') || 0);
    if (!upstream.ok) {
      return fail(response, 404, 'Report download is unavailable.');
    }
    if (declaredLength > MAX_PDF_BYTES) {
      return fail(response, 413, 'Report download is too large.');
    }

    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (bytes.length > MAX_PDF_BYTES || bytes.subarray(0, 5).toString() !== '%PDF-') {
      return fail(response, 404, 'Report download is unavailable.');
    }

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Length', String(bytes.length));
    response.setHeader('Content-Disposition', 'attachment; filename="lumen-accessibility-report.pdf"');
    return response.status(200).send(bytes);
  } catch (error) {
    console.error('Lumen PDF proxy failed.', error);
    return fail(response, 502, 'Report download could not be loaded.');
  }
}
