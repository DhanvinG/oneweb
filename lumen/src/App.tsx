import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronLeft, ChevronRight, Download, Maximize2, Minus, Plus, X } from 'lucide-react';

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

const reportPageLabels = [
  'Accessibility Snapshot',
  'Issue Categories',
  'Recommended Action Plan',
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
  const [viewerPage, setViewerPage] = useState<number | null>(null);
  const [viewerZoom, setViewerZoom] = useState(1);
  const pollTimer = useRef<number | null>(null);
  const scanIdRef = useRef('');
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const closeViewerRef = useRef<HTMLButtonElement | null>(null);
  const lastPreviewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (pollTimer.current) window.clearTimeout(pollTimer.current);
  }, []);

  useEffect(() => {
    if (viewerPage === null) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeViewerRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setViewerPage(null);
        window.setTimeout(() => lastPreviewTriggerRef.current?.focus(), 0);
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setViewerPage((current) => current === null ? current : (current + 1) % (report?.previewUrls.length || 1));
        setViewerZoom(1);
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setViewerPage((current) => current === null ? current : (current - 1 + (report?.previewUrls.length || 1)) % (report?.previewUrls.length || 1));
        setViewerZoom(1);
        return;
      }
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        setViewerZoom((current) => Math.min(2.5, current + .25));
        return;
      }
      if (event.key === '-') {
        event.preventDefault();
        setViewerZoom((current) => Math.max(.75, current - .25));
        return;
      }
      if (event.key === 'Tab' && viewerRef.current) {
        const focusable = Array.from(
          viewerRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'),
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [viewerPage, report?.previewUrls.length]);

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

  const openViewer = (index: number, trigger: HTMLButtonElement) => {
    lastPreviewTriggerRef.current = trigger;
    setViewerZoom(1);
    setViewerPage(index);
  };

  const closeViewer = () => {
    setViewerPage(null);
    window.setTimeout(() => lastPreviewTriggerRef.current?.focus(), 0);
  };

  const moveViewer = (direction: number) => {
    const pageCount = report?.previewUrls.length || 1;
    setViewerPage((current) => current === null ? current : (current + direction + pageCount) % pageCount);
    setViewerZoom(1);
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
            const pageLabel = reportPageLabels[index] || `Report Page ${index + 1}`;
            return (
              <article className="report-card" key={previewUrl}>
                <button
                  className="report-page"
                  type="button"
                  onClick={(event) => openViewer(index, event.currentTarget)}
                  aria-label={`View page ${index + 1}, ${pageLabel}, full screen`}
                >
                  <img src={proxiedUrl} alt={`Accessibility report page ${index + 1} of 3 for ${report.domain}`} />
                  <span className="report-page__hint"><Maximize2 aria-hidden="true" /> View page</span>
                </button>
                <div className="report-card__label">
                  <span>Page {index + 1}</span>
                  <strong>{pageLabel}</strong>
                </div>
              </article>
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
      {viewerPage !== null && report && (
        <div
          className="report-viewer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-viewer-title"
          ref={viewerRef}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeViewer();
          }}
        >
          <div className="report-viewer__panel">
            <header className="report-viewer__header">
              <div>
                <span>Page {viewerPage + 1} of {report.previewUrls.length}</span>
                <h2 id="report-viewer-title">{reportPageLabels[viewerPage] || `Report Page ${viewerPage + 1}`}</h2>
              </div>
              <div className="report-viewer__controls" aria-label="Report viewer controls">
                <button
                  type="button"
                  onClick={() => setViewerZoom((current) => Math.max(.75, current - .25))}
                  disabled={viewerZoom <= .75}
                  aria-label="Zoom out"
                ><Minus aria-hidden="true" /></button>
                <output aria-live="polite" aria-label="Current zoom">{Math.round(viewerZoom * 100)}%</output>
                <button
                  type="button"
                  onClick={() => setViewerZoom((current) => Math.min(2.5, current + .25))}
                  disabled={viewerZoom >= 2.5}
                  aria-label="Zoom in"
                ><Plus aria-hidden="true" /></button>
                <button type="button" onClick={() => setViewerZoom(1)} aria-label="Fit page to viewer">
                  <Maximize2 aria-hidden="true" />
                </button>
                <button type="button" onClick={closeViewer} aria-label="Close report viewer" ref={closeViewerRef}>
                  <X aria-hidden="true" />
                </button>
              </div>
            </header>
            <div
              className="report-viewer__stage"
              onTouchStart={(event) => { touchStartXRef.current = event.touches[0]?.clientX ?? null; }}
              onTouchEnd={(event) => {
                if (touchStartXRef.current === null) return;
                const distance = (event.changedTouches[0]?.clientX ?? touchStartXRef.current) - touchStartXRef.current;
                touchStartXRef.current = null;
                if (Math.abs(distance) >= 55) moveViewer(distance < 0 ? 1 : -1);
              }}
            >
              <button className="report-viewer__nav report-viewer__nav--previous" type="button" onClick={() => moveViewer(-1)} aria-label="Previous report page">
                <ChevronLeft aria-hidden="true" />
              </button>
              <div className="report-viewer__canvas">
                <div className="report-viewer__image-wrap" style={{ width: `${viewerZoom * 100}%` }}>
                  <img
                    src={previewProxyUrl(report.previewUrls[viewerPage])}
                    alt={`Accessibility report page ${viewerPage + 1} of ${report.previewUrls.length} for ${report.domain}`}
                  />
                </div>
              </div>
              <button className="report-viewer__nav report-viewer__nav--next" type="button" onClick={() => moveViewer(1)} aria-label="Next report page">
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
            <p className="report-viewer__help">Use the arrow keys to change pages, + or − to zoom, and Escape to close.</p>
          </div>
        </div>
      )}
    </main>
  );
}
