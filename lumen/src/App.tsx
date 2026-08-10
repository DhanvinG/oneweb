import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Download } from 'lucide-react';

type Screen = 'landing' | 'progress' | 'results';

type ReportResult = {
  scanId: string;
  website: string;
  domain: string;
  pdfUrl: string;
  previewUrls: string[];
  pagesReviewed: number;
};

type ApiResponse = {
  ok: boolean;
  state?: 'queued' | 'running' | 'complete' | 'error';
  stage?: number;
  message?: string;
  error?: string;
  result?: ReportResult;
};

const stages = [
  'Finding key pages',
  'Running accessibility checks',
  'Comparing findings across pages',
  'Identifying your highest priorities',
  'Building your report',
];

const apiUrl = import.meta.env.VITE_LUMEN_API_URL || '/api/lumen';

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'brand brand--compact' : 'brand'} aria-label="Lumen by OneWeb">
      <span className="brand__name">Lumen</span>
      <span className="brand__byline">by OneWeb</span>
    </div>
  );
}

function normalizeForDisplay(value: string) {
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(withProtocol).hostname.replace(/^www\./, '');
  } catch {
    return value;
  }
}

function makeScanId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `scan-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function previewProxyUrl(value: string) {
  try {
    const url = new URL(value);
    const pathMatch = url.pathname.match(/\/d\/([a-zA-Z0-9_-]{10,100})/);
    const fileId = url.searchParams.get('id') || pathMatch?.[1] || '';
    return /^[a-zA-Z0-9_-]{10,100}$/.test(fileId)
      ? `/api/lumen-preview?id=${encodeURIComponent(fileId)}`
      : value;
  } catch {
    return value;
  }
}

async function readApi(response: Response): Promise<ApiResponse> {
  const payload = (await response.json().catch(() => null)) as ApiResponse | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || 'Lumen could not complete this scan. Please try again.');
  }
  return payload;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [url, setUrl] = useState('');
  const [submittedDomain, setSubmittedDomain] = useState('');
  const [stage, setStage] = useState(0);
  const [error, setError] = useState('');
  const [report, setReport] = useState<ReportResult | null>(null);
  const pollTimer = useRef<number | null>(null);
  const scanIdRef = useRef('');

  useEffect(() => () => {
    if (pollTimer.current) window.clearTimeout(pollTimer.current);
  }, []);

  const stopPolling = () => {
    if (pollTimer.current) window.clearTimeout(pollTimer.current);
    pollTimer.current = null;
  };

  const finish = (result: ReportResult) => {
    stopPolling();
    setStage(5);
    setReport(result);
    setScreen('results');
    document.title = `Accessibility report for ${result.domain} | Lumen`;
  };

  const pollStatus = async (scanId: string) => {
    try {
      const response = await fetch(`${apiUrl}?action=status&scanId=${encodeURIComponent(scanId)}`, {
        headers: { Accept: 'application/json' },
      });
      const payload = await readApi(response);
      if (typeof payload.stage === 'number') setStage(Math.max(0, Math.min(5, payload.stage)));
      if (payload.state === 'complete' && payload.result) return finish(payload.result);
      if (payload.state === 'error') throw new Error(payload.error || 'The scan did not complete.');
    } catch (pollError) {
      // The original scan request remains authoritative; transient polling failures are safe to ignore.
    }
    pollTimer.current = window.setTimeout(() => pollStatus(scanId), 1400);
  };

  const submitScan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    let normalized: URL;
    try {
      normalized = new URL(/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`);
      if (!['http:', 'https:'].includes(normalized.protocol) || !normalized.hostname.includes('.')) {
        throw new Error();
      }
    } catch {
      setError('Enter a public website address, such as https://example.org.');
      return;
    }

    const scanId = makeScanId();
    scanIdRef.current = scanId;
    setSubmittedDomain(normalizeForDisplay(normalized.href));
    setStage(0);
    setScreen('progress');
    document.title = `Analyzing ${normalizeForDisplay(normalized.href)} | Lumen`;
    pollStatus(scanId);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ action: 'scan', scanId, url: normalized.href }),
      });
      const payload = await readApi(response);
      if (payload.result) finish(payload.result);
    } catch (scanError) {
      stopPolling();
      setError(scanError instanceof Error ? scanError.message : 'Lumen could not complete this scan.');
      setScreen('landing');
      document.title = 'Lumen by OneWeb';
    }
  };

  if (screen === 'landing') {
    return (
      <main className="app app--landing">
        <section className="landing" aria-labelledby="lumen-title">
          <h1 id="lumen-title" className="sr-only">Lumen by OneWeb website accessibility assessment</h1>
          <Brand />
          <form className="url-form" onSubmit={submitScan} noValidate>
            <label className="sr-only" htmlFor="website-url">Public website URL</label>
            <input
              id="website-url"
              name="website"
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder="https://yourwebsite.org"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              aria-describedby={error ? 'url-error' : undefined}
              aria-invalid={Boolean(error)}
              required
            />
            <button type="submit">
              <span>Analyze Website</span>
              <ArrowRight aria-hidden="true" strokeWidth={2.8} />
            </button>
          </form>
          {error && <p id="url-error" className="form-error" role="alert">{error}</p>}
        </section>
      </main>
    );
  }

  if (screen === 'progress') {
    return (
      <main className="app app--progress" aria-busy="true">
        <header className="corner-brand"><Brand compact /></header>
        <section className="progress" aria-labelledby="progress-title">
          <div className="progress__heading">
            <h1 id="progress-title">Analyzing your website</h1>
            <p>{submittedDomain}</p>
          </div>
          <div className="progress-panel" role="status" aria-live="polite" aria-atomic="true">
            <span className="sr-only">{stage === 0 ? 'Starting analysis.' : `${stages[Math.min(stage - 1, 4)]} ${stage >= 5 ? 'complete.' : 'in progress.'}`}</span>
            <ol>
              {stages.map((label, index) => {
                const number = index + 1;
                const complete = stage > number;
                const current = stage === number || (stage === 0 && index === 0);
                return (
                  <li className={`${complete ? 'is-complete' : ''} ${current ? 'is-current' : ''}`} key={label}>
                    <span className="step-marker" aria-hidden="true">{complete && <Check strokeWidth={4} />}</span>
                    <span className="step-label"><span>{number}.</span> {label}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app app--results">
      <header className="corner-brand"><Brand compact /></header>
      <section className="results" aria-labelledby="results-title">
        <h1 id="results-title">Your Report Is Ready</h1>
        <div className="report-pages" aria-label={`Three-page accessibility report for ${report?.domain || submittedDomain}`}>
          {report?.previewUrls.map((previewUrl, index) => {
            const proxiedUrl = previewProxyUrl(previewUrl);
            return (
              <a
                className="report-page"
                href={proxiedUrl}
                target="_blank"
                rel="noreferrer"
                key={previewUrl}
                aria-label={`Open report page ${index + 1} in a new tab`}
              >
                <img src={proxiedUrl} alt={`Accessibility report page ${index + 1} of 3 for ${report.domain}`} />
              </a>
            );
          })}
        </div>
        {report && (
          <a className="download-button" href={report.pdfUrl} target="_blank" rel="noreferrer">
            <span>Download PDF</span>
            <Download aria-hidden="true" strokeWidth={3} />
          </a>
        )}
      </section>
    </main>
  );
}
