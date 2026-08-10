import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowRight, Download } from 'lucide-react';
import PixelHarbor from './PixelHarbor';

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
  { title: 'Finding key pages', detail: 'Finding representative public pages' },
  { title: 'Running accessibility checks', detail: 'Reviewing page accessibility signals' },
  { title: 'Comparing findings', detail: 'Comparing patterns across 5 pages' },
  { title: 'Identifying your priorities', detail: 'Ranking the highest-impact barriers' },
  { title: 'Building your report', detail: 'Creating your three-page action plan' },
];

const apiUrl = import.meta.env.VITE_LUMEN_API_URL || '/api/lumen';
const homeTitle = 'Website Accessibility Scanner & Report | Lumen by OneWeb';

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'brand brand--compact' : 'brand'} aria-label="Lumen by OneWeb">
      <span className="brand__name">Lumen</span>
      <span className="brand__byline">
        <span>by</span>
        <img className="brand__globe" src="/oneweb-globe.png" alt="" aria-hidden="true" />
        <span>OneWeb</span>
      </span>
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

function downloadProxyUrl(value: string) {
  try {
    const url = new URL(value);
    const pathMatch = url.pathname.match(/\/d\/([a-zA-Z0-9_-]{10,100})/);
    const fileId = url.searchParams.get('id') || pathMatch?.[1] || '';
    return /^[a-zA-Z0-9_-]{10,100}$/.test(fileId)
      ? `/api/lumen-download?id=${encodeURIComponent(fileId)}`
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
  const urlInputRef = useRef<HTMLInputElement>(null);

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
    } catch {
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
      if (!['http:', 'https:'].includes(normalized.protocol) || !normalized.hostname.includes('.')) throw new Error();
    } catch {
      setError('Enter a public website address, such as https://example.org.');
      return;
    }

    const scanId = makeScanId();
    const domain = normalizeForDisplay(normalized.href);
    setSubmittedDomain(domain);
    setStage(0);
    setReport(null);
    setScreen('progress');
    document.title = `Analyzing ${domain} | Lumen`;
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
      document.title = homeTitle;
    }
  };

  const startAnotherScan = () => {
    stopPolling();
    setUrl('');
    setSubmittedDomain('');
    setStage(0);
    setError('');
    setReport(null);
    setScreen('landing');
    document.title = homeTitle;
    window.requestAnimationFrame(() => urlInputRef.current?.focus());
  };

  if (screen === 'landing') {
    return (
      <main className="app app--landing">
        <PixelHarbor mode="landing" />
        <section className="landing" aria-labelledby="lumen-title">
          <Brand compact />
          <div className="landing__copy">
            <h1 id="lumen-title">
              <span className="headline-line">A brighter path to</span>
              <span className="headline-line">an accessible web.</span>
            </h1>
            <p>Scan your public website for potential accessibility issues<br />{' '}and get a prioritized action plan.</p>
          </div>
          <form className="url-form" onSubmit={submitScan} noValidate>
            <label className="sr-only" htmlFor="website-url">Public website URL</label>
            <input
              ref={urlInputRef}
              id="website-url"
              name="website"
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder="https://yourwebsite.org"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              aria-describedby={error ? 'url-error' : 'website-help'}
              aria-invalid={Boolean(error)}
              required
            />
            <span id="website-help" className="sr-only">Enter the address of a publicly available website.</span>
            <button type="submit" aria-label="Analyze website">
              <ArrowRight aria-hidden="true" strokeWidth={2.3} />
            </button>
          </form>
          {error && <p id="url-error" className="form-error" role="alert">{error}</p>}
        </section>
      </main>
    );
  }

  if (screen === 'progress') {
    const activeStage = Math.max(1, Math.min(5, stage || 1));
    const currentStage = stages[activeStage - 1];
    return (
      <main className="app app--progress" aria-busy="true">
        <PixelHarbor mode="progress" stage={stage} />
        <section className="progress" aria-labelledby="progress-title">
          <Brand compact />
          <div className="progress__copy">
            <h1 id="progress-title">Scanning {submittedDomain}</h1>
            <p>Reviewing up to five public pages. This usually takes a few minutes.</p>
          </div>
          <div className="progress-card" role="status" aria-live="polite" aria-atomic="true">
            <span className="progress-card__spinner" aria-hidden="true" />
            <div>
              <strong>{activeStage}. {currentStage.title}</strong>
              <span>{currentStage.detail}</span>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app app--results" data-nosnippet>
      <PixelHarbor mode="results" />
      <header className="results-header">
        <Brand compact />
        <nav className="results-actions" aria-label="Report actions">
          {report && (
            <a className="action-button action-button--download" href={downloadProxyUrl(report.pdfUrl)} target="_blank" rel="nofollow noreferrer">
              <span>Download PDF</span>
              <Download aria-hidden="true" strokeWidth={2.7} />
            </a>
          )}
          <button className="action-button action-button--another" type="button" onClick={startAnotherScan}>
            <span>Scan another website</span>
            <ArrowRight aria-hidden="true" strokeWidth={2.3} />
          </button>
        </nav>
      </header>
      <section className="results" aria-labelledby="results-title">
        <h1 id="results-title" className="sr-only">Accessibility report for {report?.domain || submittedDomain}</h1>
        <div className="report-pages" aria-label={`Three-page accessibility report for ${report?.domain || submittedDomain}`}>
          {report?.previewUrls.map((previewUrl, index) => {
            const proxiedUrl = previewProxyUrl(previewUrl);
            return (
              <a
                className="report-page"
                href={proxiedUrl}
                target="_blank"
                rel="nofollow noreferrer"
                key={previewUrl}
                aria-label={`Open report page ${index + 1} in a new tab`}
              >
                <img src={proxiedUrl} alt={`Accessibility report page ${index + 1} of 3 for ${report.domain}`} />
              </a>
            );
          })}
        </div>
      </section>
    </main>
  );
}
