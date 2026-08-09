
/*
 * Lumen by OneWeb — standalone public scanner.
 *
 * This file intentionally contains only public scanning, deterministic Audit
 * Library, prioritization, native Google Slides, preview, and PDF behavior.
 * It has no spreadsheet queue, Gmail, outreach, reply, or follow-up entry point.
 */

function doGet(e) {
  return jsonOutput_({
    ok: true,
    service: 'Lumen by OneWeb',
    message: 'Use the authenticated server proxy to start or check a scan.'
  });
}

function doPost(e) {
  let scanId = '';

  try {
    const request = JSON.parse(
      e && e.postData && e.postData.contents
        ? e.postData.contents
        : '{}'
    );

    assertBackendSecret_(request.secret);

    if (request.action === 'status') {
      scanId = validateScanId_(request.scanId);
      const cached = CacheService.getScriptCache().get(statusCacheKey_(scanId));

      return jsonOutput_(cached ? JSON.parse(cached) : {
        ok: true,
        state: 'queued',
        stage: 0,
        message: 'Waiting for the scan to begin.'
      });
    }

    if (request.action !== 'scan') {
      throw new Error('Unsupported action.');
    }

    scanId = validateScanId_(request.scanId);
    const result = runLumenScan_(scanId, request.url, request.clientKey);

    return jsonOutput_({
      ok: true,
      state: 'complete',
      stage: 5,
      result: result
    });
  } catch (error) {
    const message = publicError_(error);

    if (scanId) {
      setScanStatus_(scanId, {
        ok: true,
        state: 'error',
        stage: 0,
        error: message
      });
    }

    return jsonOutput_({ ok: false, state: 'error', error: message });
  }
}

function runLumenScan_(scanId, submittedUrl, clientKey) {
  const startedAt = Date.now();
  const config = getLumenConfig_();
  requireLumenConfig_(config);
  enforceRateLimit_(clientKey, config.rateLimitPerHour);
  acquireScanSlot_(scanId, config.maxConcurrentScans);

  try {
    const website = normalizeStartingUrl_(submittedUrl);

    if (!website) {
      throw new Error('Enter a valid public HTTP or HTTPS website address.');
    }

    assertPublicHttpUrl_(website);
    assertWithinDeadline_(startedAt);

    setScanStatus_(scanId, {
      ok: true,
      state: 'running',
      stage: 1,
      message: 'Finding key pages'
    });

    const pages = discoverPublicPages_(website, config.maxPagesPerScan);
    reservePageSpeedQuota_(pages.length, config.pageSpeedDailyLimit);
    assertWithinDeadline_(startedAt);

    setScanStatus_(scanId, {
      ok: true,
      state: 'running',
      stage: 2,
      message: 'Running accessibility checks'
    });

    const auditLibrary = loadAuditLibrary_();
    const scan = scanPages_(pages, config.pageSpeedApiKey, auditLibrary);

    if (!scan.successfulPages.length) {
      throw new Error('No public page returned a usable accessibility result.');
    }

    assertWithinDeadline_(startedAt);
    setScanStatus_(scanId, {
      ok: true,
      state: 'running',
      stage: 3,
      message: 'Comparing findings across pages'
    });

    // scanPages_ performs the source script's cross-page aggregation here.
    const findings = scan.findings.slice().sort(compareFindings_);
    scan.findings = findings;

    setScanStatus_(scanId, {
      ok: true,
      state: 'running',
      stage: 4,
      message: 'Identifying your highest priorities'
    });

    // This computes the same deterministic action grouping used on report page 3.
    groupFindingsForActionPlan_(scan.findings, scan.successfulPages.length);
    assertWithinDeadline_(startedAt);

    setScanStatus_(scanId, {
      ok: true,
      state: 'running',
      stage: 5,
      message: 'Building your report'
    });

    const domain = getHost_(website).replace(/^www\./i, '');
    const report = createReport_(config, domain, website, scan);
    const result = {
      scanId: scanId,
      website: website,
      domain: domain,
      pagesReviewed: scan.successfulPages.length,
      pdfUrl: report.pdfDownloadUrl,
      previewUrls: report.previewUrls
    };

    setScanStatus_(scanId, {
      ok: true,
      state: 'complete',
      stage: 5,
      result: result
    });

    return result;
  } finally {
    releaseScanSlot_(scanId);
  }
}

function getLumenConfig_() {
  const properties = PropertiesService.getScriptProperties().getProperties();

  return {
    pageSpeedApiKey: String(properties.PAGESPEED_API_KEY || '').trim(),
    slidesTemplateId: String(properties.SLIDES_TEMPLATE_ID || '').trim(),
    generatedSlidesFolderId: String(properties.GENERATED_SLIDES_FOLDER_ID || '').trim(),
    generatedPdfsFolderId: String(properties.GENERATED_PDFS_FOLDER_ID || '').trim(),
    reportPreviewsFolderId: String(properties.REPORT_PREVIEWS_FOLDER_ID || '').trim(),
    auditLibrarySpreadsheetId: String(properties.AUDIT_LIBRARY_SPREADSHEET_ID || '').trim(),
    maxPagesPerScan: boundedInt_(properties.MAX_PAGES_PER_SCAN, 1, 5, 5),
    maxConcurrentScans: boundedInt_(properties.MAX_CONCURRENT_SCANS, 1, 5, 3),
    rateLimitPerHour: boundedInt_(properties.RATE_LIMIT_SCANS_PER_HOUR, 1, 30, 5),
    pageSpeedDailyLimit: boundedInt_(properties.PAGESPEED_DAILY_REQUEST_LIMIT, 5, 25000, 1000),
    reportRetentionHours: boundedInt_(properties.REPORT_RETENTION_HOURS, 1, 168, 24)
  };
}

function requireLumenConfig_(config) {
  const missing = [];
  if (!config.pageSpeedApiKey) missing.push('PAGESPEED_API_KEY');
  if (!config.slidesTemplateId) missing.push('SLIDES_TEMPLATE_ID');
  if (!config.generatedSlidesFolderId) missing.push('GENERATED_SLIDES_FOLDER_ID');
  if (!config.generatedPdfsFolderId) missing.push('GENERATED_PDFS_FOLDER_ID');
  if (!config.reportPreviewsFolderId) missing.push('REPORT_PREVIEWS_FOLDER_ID');
  if (!config.auditLibrarySpreadsheetId) missing.push('AUDIT_LIBRARY_SPREADSHEET_ID');

  if (missing.length) {
    throw new Error('Lumen setup is incomplete. Missing: ' + missing.join(', ') + '.');
  }
}

/**
 * Run this once from the Apps Script editor after configuring the production
 * folders. It installs one hourly cleanup trigger and removes any older copy
 * of that same managed trigger first.
 */
function installLumenCleanupTrigger() {
  const handler = 'cleanupExpiredLumenReports_';

  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === handler) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger(handler)
    .timeBased()
    .everyHours(1)
    .create();

  const result = cleanupExpiredLumenReports_();
  console.log(
    'Lumen cleanup installed. Retention: ' +
    result.retentionHours + ' hours. Files moved to Trash now: ' +
    result.trashedFiles + '.'
  );

  return result;
}

/**
 * Moves expired generated presentations, PDFs, and PNG previews to Drive
 * Trash. The source Slides template, Audit Library, and parent folders are
 * never touched. Because the trigger runs hourly, files are normally removed
 * between 24 and 25 hours after creation when retention is set to 24.
 */
function cleanupExpiredLumenReports_() {
  const config = getLumenConfig_();
  const folderDefinitions = [
    ['Generated Slides', config.generatedSlidesFolderId],
    ['Generated PDFs', config.generatedPdfsFolderId],
    ['Report Previews', config.reportPreviewsFolderId]
  ];
  const missingFolders = folderDefinitions.filter(function (item) {
    return !item[1];
  });

  if (missingFolders.length) {
    throw new Error(
      'Lumen cleanup cannot run because these folder properties are missing: ' +
      missingFolders.map(function (item) { return item[0]; }).join(', ') + '.'
    );
  }

  const cutoff = Date.now() - config.reportRetentionHours * 60 * 60 * 1000;
  const details = [];
  let trashedFiles = 0;

  folderDefinitions.forEach(function (item) {
    const folder = DriveApp.getFolderById(item[1]);
    const files = folder.getFiles();
    let folderCount = 0;

    while (files.hasNext()) {
      const file = files.next();
      if (file.getDateCreated().getTime() <= cutoff) {
        file.setTrashed(true);
        folderCount += 1;
        trashedFiles += 1;
      }
    }

    details.push({ folder: item[0], trashedFiles: folderCount });
  });

  const result = {
    retentionHours: config.reportRetentionHours,
    trashedFiles: trashedFiles,
    details: details,
    completedAt: new Date().toISOString()
  };

  console.log(JSON.stringify(result));
  return result;
}

function assertBackendSecret_(provided) {
  const expected = String(
    PropertiesService.getScriptProperties().getProperty('LUMEN_BACKEND_SECRET') || ''
  );

  if (!expected || String(provided || '') !== expected) {
    throw new Error('Not authorized.');
  }
}

function validateScanId_(value) {
  const scanId = String(value || '').trim();
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(scanId)) {
    throw new Error('Invalid scan identifier.');
  }
  return scanId;
}

function statusCacheKey_(scanId) {
  return 'LUMEN_STATUS_' + scanId;
}

function setScanStatus_(scanId, status) {
  CacheService.getScriptCache().put(
    statusCacheKey_(scanId),
    JSON.stringify(status),
    21600
  );
}

function jsonOutput_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function publicError_(error) {
  const message = cleanError_(error);
  if (/key=|token|secret|credential/i.test(message)) {
    return 'Lumen could not complete the scan because its service configuration needs attention.';
  }
  return message;
}

function enforceRateLimit_(clientKey, limit) {
  const key = String(clientKey || '').trim();
  if (!/^[a-f0-9]{64}$/i.test(key)) {
    throw new Error('The scan request did not include a valid client identifier.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const cache = CacheService.getScriptCache();
    const cacheKey = 'LUMEN_RATE_' + key;
    const count = Number(cache.get(cacheKey) || 0);
    if (count >= limit) {
      throw new Error('Too many scans were requested from this connection. Try again in about an hour.');
    }
    cache.put(cacheKey, String(count + 1), 3600);
  } finally {
    lock.releaseLock();
  }
}

function acquireScanSlot_(scanId, maximum) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const properties = PropertiesService.getScriptProperties();
    const now = Date.now();
    let active = [];
    try {
      active = JSON.parse(properties.getProperty('LUMEN_ACTIVE_SCANS') || '[]');
    } catch (error) {
      active = [];
    }
    active = active.filter(function (entry) {
      return entry && now - Number(entry.startedAt || 0) < 360000;
    });
    if (active.length >= maximum) {
      throw new Error('Lumen is handling several scans right now. Please try again shortly.');
    }
    active.push({ scanId: scanId, startedAt: now });
    properties.setProperty('LUMEN_ACTIVE_SCANS', JSON.stringify(active));
  } finally {
    lock.releaseLock();
  }
}

function releaseScanSlot_(scanId) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const properties = PropertiesService.getScriptProperties();
    let active = [];
    try {
      active = JSON.parse(properties.getProperty('LUMEN_ACTIVE_SCANS') || '[]');
    } catch (error) {
      active = [];
    }
    active = active.filter(function (entry) {
      return entry && entry.scanId !== scanId;
    });
    properties.setProperty('LUMEN_ACTIVE_SCANS', JSON.stringify(active));
  } finally {
    lock.releaseLock();
  }
}

function reservePageSpeedQuota_(requestCount, dailyLimit) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const properties = PropertiesService.getScriptProperties();
    const day = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
    const storedDay = properties.getProperty('LUMEN_PAGESPEED_QUOTA_DAY');
    let used = storedDay === day
      ? Number(properties.getProperty('LUMEN_PAGESPEED_QUOTA_USED') || 0)
      : 0;
    if (used + requestCount > dailyLimit) {
      throw new Error('Lumen has reached today\'s scan capacity. Please try again tomorrow.');
    }
    used += requestCount;
    properties.setProperties({
      LUMEN_PAGESPEED_QUOTA_DAY: day,
      LUMEN_PAGESPEED_QUOTA_USED: String(used)
    }, false);
  } finally {
    lock.releaseLock();
  }
}

function assertWithinDeadline_(startedAt) {
  if (Date.now() - startedAt > 330000) {
    throw new Error('The scan exceeded Lumen\'s processing time limit. Please try again.');
  }
}

function assertPublicHttpUrl_(value) {
  const normalized = normalizeStartingUrl_(value);
  const match = normalized.match(/^(https?):\/\/([^/?#]+)(?:[/?#]|$)/i);
  if (!match) throw new Error('Only public HTTP and HTTPS website addresses are supported.');

  const authority = match[2];
  if (authority.indexOf('@') !== -1) throw new Error('Website addresses with embedded credentials are not supported.');

  let host = authority;
  let port = '';
  if (host.charAt(0) === '[') throw new Error('IPv6 URL literals are not supported.');
  const portMatch = host.match(/:(\d+)$/);
  if (portMatch) {
    port = portMatch[1];
    host = host.slice(0, -(port.length + 1));
  }
  if (port && port !== '80' && port !== '443') throw new Error('Only standard web ports are supported.');

  host = host.toLowerCase().replace(/\.$/, '');
  if (!host || host === 'localhost' || /\.(local|localhost|internal|home|lan)$/.test(host)) {
    throw new Error('Local and private network addresses cannot be scanned.');
  }

  const addresses = resolveHostAddresses_(host);
  if (!addresses.length) throw new Error('The website host could not be resolved.');
  addresses.forEach(assertPublicIp_);
  return normalized;
}

function resolveHostAddresses_(host) {
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return [host];
  const addresses = [];
  ['A', 'AAAA'].forEach(function (type) {
    const response = UrlFetchApp.fetch(
      'https://dns.google/resolve?name=' + encodeURIComponent(host) + '&type=' + type,
      { muteHttpExceptions: true, followRedirects: false }
    );
    if (response.getResponseCode() !== 200) return;
    const payload = JSON.parse(response.getContentText() || '{}');
    (payload.Answer || []).forEach(function (answer) {
      if (answer && (answer.type === 1 || answer.type === 28)) addresses.push(String(answer.data || ''));
    });
  });
  return unique_(addresses.filter(Boolean));
}

function assertPublicIp_(address) {
  if (address.indexOf(':') !== -1) {
    const ip = address.toLowerCase();
    if (
      ip === '::' || ip === '::1' || /^f[cd]/.test(ip) ||
      /^fe[89ab]/.test(ip) || /^2001:db8/.test(ip) || /^::ffff:/.test(ip)
    ) {
      throw new Error('Private, loopback, link-local, and reserved addresses cannot be scanned.');
    }
    return;
  }

  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(function (part) { return part < 0 || part > 255 || isNaN(part); })) {
    throw new Error('The website resolved to an invalid network address.');
  }
  const a = parts[0];
  const b = parts[1];
  const c = parts[2];
  const blocked =
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0 && c === 113);
  if (blocked) throw new Error('Private, loopback, link-local, and reserved addresses cannot be scanned.');
}

function fetchPublicHtml_(startingUrl) {
  let currentUrl = assertPublicHttpUrl_(startingUrl);

  for (let redirect = 0; redirect <= 5; redirect += 1) {
    const response = UrlFetchApp.fetch(currentUrl, {
      followRedirects: false,
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Lumen by OneWeb Accessibility Screening/1.0' }
    });
    const code = response.getResponseCode();
    if (code >= 300 && code < 400) {
      const headers = response.getHeaders();
      const location = headers.Location || headers.location;
      if (!location || redirect === 5) throw new Error('The website redirected too many times.');
      currentUrl = assertPublicHttpUrl_(resolveUrl_(location, currentUrl));
      continue;
    }
    return { response: response, finalUrl: currentUrl };
  }

  throw new Error('The website could not be fetched safely.');
}

function getHost_(value) {
  const match = String(value || '').match(/^https?:\/\/([^/?#:]+)/i);
  return match ? match[1].toLowerCase() : '';
}


const ONEWEB = Object.freeze({
  AUDIT_LIBRARY_SHEET: 'Audit Library',
  HEADER_ROW: 2,
  FIRST_DATA_ROW: 3,
  TIME_ZONE: 'America/New_York',
  MAX_DISPLAYED_FINDINGS: 7,
  MAX_ACTION_GROUPS: 4,
  SEVERITY_POINTS: {
    Critical: 400,
    Serious: 300,
    Moderate: 200,
    Minor: 100
  },
  SEVERITY_COLORS: {
    Critical: '#D90429',
    Serious: '#F26A00',
    Moderate: '#2356D8',
    Minor: '#5B35C9'
  },
  SEVERITY_BACKGROUND_COLORS: {
    Critical: '#FFF0F3',
    Serious: '#FFF3E8',
    Moderate: '#EEF4FF',
    Minor: '#F3EEFF'
  },
  TEXT_LIMITS: {
    FINDING_TITLE: 75,
    FINDING_IMPACT: 150,
    FINDING_ACTION: 165,
    MOST_AFFECTED_PAGE: 40,
    ACTION_TITLE: 60,
    ACTION_BODY: 170,
    VALIDATION_TEXT: 240
  }
});

const ONEWEB_ACTION_GROUPS = Object.freeze({
  ALTERNATIVE_TEXT: Object.freeze({
    name: 'Alternative text',
    title: 'Add meaningful text alternatives',
    iconKey: 'IMAGE',
    instruction:
      'Add accurate alternative text to informative images and mark decorative images appropriately.',
    verificationCheck:
      'Review affected images and image controls with a screen reader.',
    validationKeys: ['SCREEN_READER']
  }),
  INTERACTIVE_TARGETS: Object.freeze({
    name: 'Interactive sizing',
    title: 'Improve interactive control sizing',
    iconKey: 'TOUCH',
    instruction:
      'Increase the size of small tap targets and add sufficient spacing between interactive elements.',
    verificationCheck:
      'Retest controls on mobile and touch devices.',
    validationKeys: ['KEYBOARD', 'TOUCH']
  }),
  NAMES_LABELS: Object.freeze({
    name: 'Names and labels',
    title: 'Provide clear names and form labels',
    iconKey: 'LABEL',
    instruction:
      'Add descriptive names to buttons and links. Label form controls and provide clear instructions.',
    verificationCheck:
      'Confirm control names, labels, purposes, instructions, and errors with a screen reader.',
    validationKeys: ['SCREEN_READER', 'FORMS']
  }),
  ARIA_SEMANTICS: Object.freeze({
    name: 'ARIA semantics',
    title: 'Correct ARIA roles and states',
    iconKey: 'ARIA',
    instruction:
      'Correct invalid ARIA roles, states, properties, and relationships so they match each control’s behavior.',
    verificationCheck:
      'Inspect the accessibility tree and retest affected controls with a screen reader.',
    validationKeys: ['SCREEN_READER']
  }),
  VISUAL_PRESENTATION: Object.freeze({
    name: 'Color and visual presentation',
    title: 'Improve color and visual presentation',
    iconKey: 'CONTRAST',
    instruction:
      'Correct insufficient contrast and ensure meaning is not communicated through color alone.',
    verificationCheck:
      'Retest contrast and review content at 200% zoom and narrow widths.',
    validationKeys: ['VISUAL']
  }),
  KEYBOARD_FOCUS: Object.freeze({
    name: 'Keyboard and focus',
    title: 'Restore keyboard and focus behavior',
    iconKey: 'KEYBOARD',
    instruction:
      'Ensure controls are reachable in a logical order, provide visible focus, and avoid custom tab-order conflicts.',
    verificationCheck:
      'Navigate the affected pages using only a keyboard.',
    validationKeys: ['KEYBOARD']
  }),
  STRUCTURE_NAVIGATION: Object.freeze({
    name: 'Structure and navigation',
    title: 'Repair structure and landmarks',
    iconKey: 'STRUCTURE',
    instruction:
      'Add accurate landmarks and organize headings and page regions into a logical hierarchy.',
    verificationCheck:
      'Review headings and landmarks with a screen reader.',
    validationKeys: ['SCREEN_READER', 'KEYBOARD']
  }),
  LANGUAGE_METADATA: Object.freeze({
    name: 'Language and page metadata',
    title: 'Correct page language and metadata',
    iconKey: 'LANGUAGE',
    instruction:
      'Provide descriptive page titles and valid language metadata for pages and language changes.',
    verificationCheck:
      'Confirm page titles and pronunciation behavior with assistive technology.',
    validationKeys: ['SCREEN_READER']
  }),
  LISTS_TABLES: Object.freeze({
    name: 'Lists and tables',
    title: 'Repair list and table structure',
    iconKey: 'TABLE',
    instruction:
      'Use valid list markup and connect table headers with the data cells they describe.',
    verificationCheck:
      'Navigate affected lists and tables with a screen reader.',
    validationKeys: ['SCREEN_READER', 'TABLES']
  }),
  MEDIA_EMBEDDED: Object.freeze({
    name: 'Media and embedded content',
    title: 'Improve media and embedded content',
    iconKey: 'CAPTIONS',
    instruction:
      'Add accurate labels and alternatives for embedded content, and provide synchronized captions for video.',
    verificationCheck:
      'Review captions, transcripts, embedded titles, and media controls.',
    validationKeys: ['MEDIA', 'SCREEN_READER']
  }),
RESPONSIVE_TIMING: Object.freeze({
  name: 'Timing, zoom and responsive behavior',
  title: 'Improve zoom and responsive behavior',
  iconKey: 'RESPONSIVE',
  instruction:
    'Allow user scaling and confirm content reflows without clipping, overlap, or loss of functionality.',
  verificationCheck:
    'Review the affected pages at 200% zoom and narrow viewport widths.',
  validationKeys: ['VISUAL', 'KEYBOARD']
}),

TIMING_REFRESH: Object.freeze({
  name: 'Timing and automatic refresh',
  title: 'Remove uncontrolled automatic refresh',
  iconKey: 'RESPONSIVE',
  instruction:
    'Remove automatic refreshes or redirects and provide a user-controlled alternative when updated content is necessary.',
  verificationCheck:
    'Confirm pages do not refresh or redirect automatically without user control.',
  validationKeys: ['KEYBOARD']
}),

GENERAL: Object.freeze({
    name: 'General remediation',
    title: 'Correct remaining accessibility barriers',
    iconKey: 'DEFAULT',
    instruction:
      'Review the affected elements and correct the underlying markup, content, or interaction.',
    verificationCheck:
      'Retest the affected content using the most relevant manual method.',
    validationKeys: ['SCREEN_READER', 'KEYBOARD']
  })
});

const ONEWEB_AUDIT_GROUP_MAP = Object.freeze({
  accesskeys: 'KEYBOARD_FOCUS',
  'aria-allowed-attr': 'ARIA_SEMANTICS',
  'aria-command-name': 'NAMES_LABELS',
  'aria-conditional-attr': 'ARIA_SEMANTICS',
  'aria-deprecated-role': 'ARIA_SEMANTICS',
  'aria-dialog-name': 'NAMES_LABELS',
  'aria-hidden-body': 'ARIA_SEMANTICS',
  'aria-hidden-focus': 'KEYBOARD_FOCUS',
  'aria-input-field-name': 'NAMES_LABELS',
  'aria-meter-name': 'NAMES_LABELS',
  'aria-progressbar-name': 'NAMES_LABELS',
  'aria-prohibited-attr': 'ARIA_SEMANTICS',
  'aria-required-attr': 'ARIA_SEMANTICS',
  'aria-required-children': 'ARIA_SEMANTICS',
  'aria-required-parent': 'ARIA_SEMANTICS',
  'aria-roles': 'ARIA_SEMANTICS',
  'aria-text': 'ARIA_SEMANTICS',
  'aria-toggle-field-name': 'NAMES_LABELS',
  'aria-tooltip-name': 'NAMES_LABELS',
  'aria-treeitem-name': 'NAMES_LABELS',
  'aria-valid-attr-value': 'ARIA_SEMANTICS',
  'aria-valid-attr': 'ARIA_SEMANTICS',
  'button-name': 'NAMES_LABELS',
  bypass: 'KEYBOARD_FOCUS',
  'color-contrast': 'VISUAL_PRESENTATION',
  'definition-list': 'LISTS_TABLES',
  dlitem: 'LISTS_TABLES',
  'document-title': 'LANGUAGE_METADATA',
  'duplicate-id-aria': 'ARIA_SEMANTICS',
  'form-field-multiple-labels': 'NAMES_LABELS',
  'frame-title': 'MEDIA_EMBEDDED',
  'heading-order': 'STRUCTURE_NAVIGATION',
  'html-has-lang': 'LANGUAGE_METADATA',
  'html-lang-valid': 'LANGUAGE_METADATA',
  'image-alt': 'ALTERNATIVE_TEXT',
  'input-button-name': 'NAMES_LABELS',
  'input-image-alt': 'ALTERNATIVE_TEXT',
  label: 'NAMES_LABELS',
  'label-content-name-mismatch': 'NAMES_LABELS',
  'landmark-one-main': 'STRUCTURE_NAVIGATION',
  'link-in-text-block': 'VISUAL_PRESENTATION',
  'link-name': 'NAMES_LABELS',
  list: 'LISTS_TABLES',
  listitem: 'LISTS_TABLES',
  'meta-refresh': 'TIMING_REFRESH',
  'meta-viewport': 'RESPONSIVE_TIMING',
  'object-alt': 'ALTERNATIVE_TEXT',
  'select-name': 'NAMES_LABELS',
  'skip-link': 'KEYBOARD_FOCUS',
  tabindex: 'KEYBOARD_FOCUS',
  'table-duplicate-name': 'LISTS_TABLES',
  'target-size': 'INTERACTIVE_TARGETS',
  'tap-targets': 'INTERACTIVE_TARGETS',
  'td-headers-attr': 'LISTS_TABLES',
  'th-has-data-cells': 'LISTS_TABLES',
  'valid-lang': 'LANGUAGE_METADATA',
  'video-caption': 'MEDIA_EMBEDDED',
  'custom-controls-labels': 'NAMES_LABELS',
  'focus-traps': 'KEYBOARD_FOCUS',
  'logical-tab-order': 'KEYBOARD_FOCUS',
  'use-landmarks': 'STRUCTURE_NAVIGATION'
});


function discoverPublicPages_(startingUrl, maxPages) {
  const fetched = fetchPublicHtml_(startingUrl);
  startingUrl = fetched.finalUrl;
  const origin = getOrigin_(startingUrl);
  const accepted = [startingUrl];
  const seen = {};
  seen[startingUrl] = true;

  const skippedExtensions =
    /\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|jpe?g|png|gif|svg|webp|mp4|mp3|css|js|xml)(\?|$)/i;

  if (maxPages <= 1) {
    return accepted;
  }

  const response = fetched.response;

  const code = response.getResponseCode();
  const responseHeaders = response.getHeaders();
  const contentType = String(
    responseHeaders['Content-Type'] || responseHeaders['content-type'] || ''
  ).toLowerCase();

  if (
    code < 200 ||
    code >= 400 ||
    contentType.indexOf('text/html') === -1
  ) {
    return accepted;
  }

  const html = response.getContentText().slice(0, 2000000);
  const hrefPattern =
    /<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)["']/gi;

  const candidates = [];
  let match;

  while (
    (match = hrefPattern.exec(html)) !== null &&
    candidates.length < 250
  ) {
    const href = String(match[1] || '').trim();

    if (
      !href ||
      /^(mailto:|tel:|javascript:|data:)/i.test(href)
    ) {
      continue;
    }

    const candidate = resolveUrl_(href, startingUrl);

    if (
      candidate &&
      getOrigin_(candidate) === origin &&
      !seen[candidate] &&
      !skippedExtensions.test(candidate)
    ) {
      seen[candidate] = true;
      candidates.push(candidate);
    }
  }

  candidates.sort(function (a, b) {
    const scoreDifference =
      pageCandidateScore_(b) - pageCandidateScore_(a);

    return scoreDifference || a.length - b.length;
  });

  return accepted.concat(
    candidates.slice(0, maxPages - 1)
  );
}

function pageCandidateScore_(url) {
  const path = String(url || '')
    .replace(/^https?:\/\/[^/]+/i, '')
    .toLowerCase();

  if (/\/(about|who-we-are|mission)(\/|$)/.test(path)) {
    return 50;
  }

  if (/\/(services|programs|what-we-do)(\/|$)/.test(path)) {
    return 45;
  }

  if (/\/(contact|connect)(\/|$)/.test(path)) {
    return 40;
  }

  if (/\/(donate|support|give)(\/|$)/.test(path)) {
    return 35;
  }

  if (/\/(news|events|resources)(\/|$)/.test(path)) {
    return 25;
  }

  return Math.max(1, 20 - path.split('/').length);
}

function scanPages_(pages, apiKey, auditLibrary) {
  const rawPages = [];
  const successfulPages = [];
  const findingsById = {};
  const scores = [];

  const requests = pages.map(function (pageUrl) {
    const query = [
      'url=' + encodeURIComponent(pageUrl),
      'category=accessibility',
      'strategy=mobile'
    ];

    if (apiKey) {
      query.push('key=' + encodeURIComponent(apiKey));
    }

    return {
      url:
        'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?' +
        query.join('&'),
      muteHttpExceptions: true,
      followRedirects: true
    };
  });

  let responses;

  try {
    responses = UrlFetchApp.fetchAll(requests);
  } catch (error) {
    pages.forEach(function (pageUrl) {
      rawPages.push({
        url: pageUrl,
        ok: false,
        error: cleanError_(error)
      });
    });

    return {
      requestedPages: pages,
      successfulPages: [],
      averageScore: '',
      barrierInstances: 0,
      findings: [],
      rawPages: rawPages
    };
  }

  responses.forEach(function (response, pageIndex) {
    const pageUrl = pages[pageIndex];
    let payload;

    try {
      payload = JSON.parse(response.getContentText());
    } catch (error) {
      rawPages.push({
        url: pageUrl,
        ok: false,
        httpStatus: response.getResponseCode(),
        error: cleanError_(error)
      });
      return;
    }

    if (
      response.getResponseCode() < 200 ||
      response.getResponseCode() >= 300
    ) {
      rawPages.push({
        url: pageUrl,
        ok: false,
        httpStatus: response.getResponseCode(),
        error: payload.error || payload
      });
      return;
    }

    const lighthouse = payload.lighthouseResult;
    const category =
      lighthouse &&
      lighthouse.categories &&
      lighthouse.categories.accessibility;

    if (!lighthouse || !category) {
      rawPages.push({
        url: pageUrl,
        ok: false,
        error:
          'Accessibility category was missing from the response.'
      });
      return;
    }

    const finalPageUrl = String(
      lighthouse.finalDisplayedUrl || lighthouse.finalUrl || pageUrl
    );

    try {
      assertPublicHttpUrl_(finalPageUrl);
    } catch (error) {
      rawPages.push({
        url: pageUrl,
        ok: false,
        error: 'The tested page redirected to a blocked or non-public address.'
      });
      return;
    }

    successfulPages.push(pageUrl);

    if (typeof category.score === 'number') {
      scores.push(category.score * 100);
    }

    const auditRefs = category.auditRefs || [];

    auditRefs.forEach(function (ref) {
      const audit =
        lighthouse.audits &&
        lighthouse.audits[ref.id];

      if (
        !isFailedAutomatedAudit_(
          audit,
          auditLibrary[ref.id]
        )
      ) {
        return;
      }

      const libraryItem = auditLibrary[ref.id] || {};
      const actionMetadata = resolveAuditActionMetadata_(
        ref.id,
        libraryItem
      );
      const severity = normalizeSeverity_(
        libraryItem.priority || 'Serious'
      );
      const pageInstances = countAuditInstances_(audit);

      if (!findingsById[ref.id]) {
        findingsById[ref.id] = {
          id: ref.id,
          title:
            libraryItem.title ||
            audit.title ||
            ref.id,
          severity: severity,
          count: 0,
          description:
            libraryItem.whatThisMeans ||
            audit.description ||
            'The automated check identified a potential accessibility barrier.',
          action:
            libraryItem.recommendedAction ||
            'Review the affected elements and correct the underlying markup or interaction.',
          impact: libraryItem.impact || '',
          wcag: libraryItem.wcag || '',
          pages: [],
          pageCounts: {},
          affectedPageCount: 0,
          coveragePercent: 0,
          priorityScore: 0,
          rankReason: '',
          actionGroup: actionMetadata.actionGroup,
          actionGroupKey: actionMetadata.actionGroupKey,
          actionPlanTitle: actionMetadata.actionPlanTitle,
          actionIconKey: actionMetadata.actionIconKey,
          verificationCheck: actionMetadata.verificationCheck,
          validationKeys: actionMetadata.validationKeys
        };
      }

      findingsById[ref.id].count += pageInstances;
      findingsById[ref.id].pageCounts[pageUrl] =
        (findingsById[ref.id].pageCounts[pageUrl] || 0) +
        pageInstances;
      findingsById[ref.id].pages.push(pageUrl);
    });

    rawPages.push({
      url: pageUrl,
      ok: true,
      fetchedAt:
        lighthouse.fetchTime ||
        new Date().toISOString(),
      accessibilityScore:
        typeof category.score === 'number'
          ? Math.round(category.score * 100)
          : null
    });
  });

  const reviewedPageCount = successfulPages.length;

  const findings = Object.keys(findingsById)
    .map(function (id) {
      const finding = findingsById[id];
      finding.pages = unique_(finding.pages);
      finding.affectedPageCount = finding.pages.length;
      finding.coveragePercent = reviewedPageCount > 0
        ? Math.round(
            100 * finding.affectedPageCount /
            reviewedPageCount
          )
        : 0;
      finding.mostAffectedPage = getMostAffectedPage_(finding);
      finding.priorityScore = calculatePriorityScore_(
        finding,
        reviewedPageCount
      );
      finding.rankReason = buildRankReason_(
        finding,
        reviewedPageCount
      );
      return finding;
    })
    .sort(compareFindings_);

  return {
    requestedPages: pages,
    successfulPages: successfulPages,
    averageScore: scores.length
      ? Math.round(
          scores.reduce(function (sum, value) {
            return sum + value;
          }, 0) / scores.length
        )
      : '',
    barrierInstances: findings.reduce(function (sum, finding) {
      return sum + finding.count;
    }, 0),
    findings: findings,
    rawPages: rawPages
  };
}

function isFailedAutomatedAudit_(audit, libraryItem) {
  if (
    !audit ||
    typeof audit.score !== 'number' ||
    audit.score >= 1
  ) {
    return false;
  }

  const mode = String(
    audit.scoreDisplayMode || ''
  ).toLowerCase();

  if (
    mode === 'manual' ||
    mode === 'informative' ||
    mode === 'notapplicable' ||
    mode === 'error'
  ) {
    return false;
  }

  if (
    libraryItem &&
    libraryItem.automated === false
  ) {
    return false;
  }

  return true;
}

function countAuditInstances_(audit) {
  const items =
    audit &&
    audit.details &&
    Array.isArray(audit.details.items)
      ? audit.details.items
      : [];

  if (!items.length) {
    return 1;
  }

  return items.reduce(function (total, item) {
    if (
      item &&
      Array.isArray(item.nodes) &&
      item.nodes.length
    ) {
      return total + item.nodes.length;
    }

    return total + 1;
  }, 0);
}

function loadAuditLibrary_() {
  const spreadsheetId = String(
    PropertiesService.getScriptProperties().getProperty('AUDIT_LIBRARY_SPREADSHEET_ID') || ''
  ).trim();

  if (!spreadsheetId) {
    throw new Error('AUDIT_LIBRARY_SPREADSHEET_ID is not configured.');
  }

  const sheet = SpreadsheetApp.openById(spreadsheetId)
    .getSheetByName(ONEWEB.AUDIT_LIBRARY_SHEET);

  if (!sheet) {
    throw new Error('Audit Library tab was not found.');
  }

  const lastRow = sheet.getLastRow();

  if (lastRow < ONEWEB.FIRST_DATA_ROW) {
    return {};
  }

  const lastColumn = Math.max(sheet.getLastColumn(), 12);
  const headers = sheet.getRange(
    ONEWEB.HEADER_ROW,
    1,
    1,
    lastColumn
  ).getValues()[0];

  const headerMap = {};
  headers.forEach(function (header, index) {
    const key = String(header || '').trim();
    if (key) {
      headerMap[key] = index;
    }
  });

  const requiredNewHeaders = [
    'Action Group',
    'Action Plan Title',
    'Action Icon Key',
    'Verification Check'
  ];

  const missingNewHeaders = requiredNewHeaders.filter(function (header) {
    return headerMap[header] == null;
  });

  if (missingNewHeaders.length) {
    throw new Error(
      'Audit Library is missing the new report columns. Run upgradeAuditLibraryForThreePageReports once.'
    );
  }

  const values = sheet.getRange(
    ONEWEB.FIRST_DATA_ROW,
    1,
    lastRow - ONEWEB.FIRST_DATA_ROW + 1,
    lastColumn
  ).getValues();

  const library = {};

  values.forEach(function (row) {
    const id = String(
      getCellByHeader_(row, headerMap, 'Audit ID', 0) || ''
    ).trim();

    if (!id) {
      return;
    }

    const automatedValue = getCellByHeader_(
      row,
      headerMap,
      'Automated',
      6
    );

    library[id] = {
      title: getCellByHeader_(row, headerMap, 'Friendly Title', 1),
      impact: getCellByHeader_(row, headerMap, 'Impact', 2),
      whatThisMeans: getCellByHeader_(row, headerMap, 'What This Means', 3),
      recommendedAction: getCellByHeader_(row, headerMap, 'Recommended Action', 4),
      priority: getCellByHeader_(row, headerMap, 'Priority', 5),
      automated:
        String(automatedValue || '').trim() === ''
          ? true
          : toBoolean_(automatedValue),
      wcag: getCellByHeader_(row, headerMap, 'WCAG Reference', 7),
      actionGroup: getCellByHeader_(row, headerMap, 'Action Group', 8),
      actionPlanTitle: getCellByHeader_(row, headerMap, 'Action Plan Title', 9),
      actionIconKey: getCellByHeader_(row, headerMap, 'Action Icon Key', 10),
      verificationCheck: getCellByHeader_(row, headerMap, 'Verification Check', 11)
    };
  });

  return library;
}

function createReport_(
  config,
  organizationName,
  website,
  scan
) {
  const slidesFolder = DriveApp.getFolderById(
    config.generatedSlidesFolderId
  );

  const pdfFolder = DriveApp.getFolderById(
    config.generatedPdfsFolderId
  );

  const template = DriveApp.getFileById(
    config.slidesTemplateId
  );

  const dateLabel = Utilities.formatDate(
    new Date(),
    ONEWEB.TIME_ZONE,
    'MMMM d, yyyy'
  );

  const dateUpper = dateLabel.toUpperCase();
  const reportReference = buildReportReference_(organizationName);

  const fileStem =
    safeFilename_(organizationName) +
    '_Accessibility_Report';

  const slidesFile = template.makeCopy(
    fileStem,
    slidesFolder
  );

  const presentation = SlidesApp.openById(
    slidesFile.getId()
  );

  const templateSlides = presentation.getSlides();

  if (templateSlides.length !== 3) {
    throw new Error(
      'The final Slides report template must contain exactly three slides: Page 1, Page 2, and Page 3 in that order.'
    );
  }

  const coverSlide = templateSlides[0];
  const additionalSlide = templateSlides[1];
  const actionSlide = templateSlides[2];
  const totalPages = 3;

  /*
   * The template page numbers are hardcoded. Clear any legacy
   * {{PAGE_NUMBER}} token that may still be present in an older copy.
   */
  templateSlides.forEach(function (slide) {
    slide.replaceAllText('{{PAGE_NUMBER}}', '');
  });

  replaceSlideText_(coverSlide, {
    '{{ORGANIZATION_NAME}}': organizationName,
    '{{REVIEW_DATE_UPPER}}': dateUpper,
    '{{BARRIERS}}': String(scan.barrierInstances),
    '{{CATEGORIES}}': String(scan.findings.length),
    '{{PAGES}}': String(scan.successfulPages.length)
  });

  for (let topIndex = 0; topIndex < 3; topIndex += 1) {
    const topFinding = scan.findings[topIndex];
    const topPrefix = 'F' + (topIndex + 1);

    if (topFinding) {
      fillFindingSlot_(
        coverSlide,
        topPrefix,
        topFinding,
        topIndex + 1,
        scan.successfulPages.length
      );
    } else {
      removePage1FindingCard_(coverSlide, topPrefix);
    }
  }

  populatePage1DetailFields_(
    coverSlide,
    scan.findings.slice(0, 3)
  );

  populateAdditionalFindingsPage_(additionalSlide, scan);

  populateActionPlanPage_(
    actionSlide,
    website,
    dateLabel,
    reportReference,
    scan
  );

  const previewPageIds = templateSlides.map(function (slide) {
    return slide.getObjectId();
  });

  presentation.saveAndClose();

  const pdfBlob = DriveApp
    .getFileById(slidesFile.getId())
    .getAs(MimeType.PDF)
    .setName(fileStem + '.pdf');

  const pdfFile = pdfFolder.createFile(pdfBlob);
  const previewFiles = createSlidePreviews_(
    config,
    slidesFile.getId(),
    previewPageIds,
    fileStem
  );

  slidesFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  previewFiles.forEach(function (file) {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  });

  return {
    slidesFile: slidesFile,
    pdfFile: pdfFile,
    website: website,
    pageCount: totalPages,
    pdfDownloadUrl: 'https://drive.google.com/uc?export=download&id=' + pdfFile.getId(),
    previewUrls: previewFiles.map(function (file) {
      return 'https://drive.google.com/uc?export=view&id=' + file.getId();
    })
  };
}


function populateAdditionalFindingsPage_(slide, scan) {
  for (let index = 3; index < 7; index += 1) {
    const finding = scan.findings[index];
    const prefix = 'F' + (index + 1);

    if (finding) {
      fillFindingSlot_(
        slide,
        prefix,
        finding,
        index + 1,
        scan.successfulPages.length
      );
    } else {
      removeGroupedTemplateSlot_(
        slide,
        '{{' + prefix + '_NUMBER}}'
      );
    }
  }

  const summary = buildRemainingFindingsSummary_(scan.findings);

  replaceSlideText_(slide, {
    '{{ADDITIONAL_COUNT}}': summary.displayCount,
    '{{ADDITIONAL_CRITICAL}}': summary.critical,
    '{{ADDITIONAL_SERIOUS}}': summary.serious,
    '{{ADDITIONAL_MODERATE}}': summary.moderate,
    '{{ADDITIONAL_MINOR}}': summary.minor,
    '{{ADDITIONAL_SUMMARY_TITLE}}': summary.title,
    '{{ADDITIONAL_SUMMARY_BODY}}': summary.body
  });
}


function populateActionPlanPage_(
  slide,
  website,
  dateLabel,
  reportReference,
  scan
) {
  const groups = groupFindingsForActionPlan_(
    scan.findings,
    scan.successfulPages.length
  ).slice(0, ONEWEB.MAX_ACTION_GROUPS);

  replaceSlideText_(slide, {
    '{{REVIEW_METHOD}}': 'Initial automated accessibility screening',
    '{{REVIEWED_PAGES}}':
      formatReviewedPages_(scan.successfulPages),
    '{{WEBSITE}}': website,
    '{{REVIEW_DATE}}': dateLabel,
    '{{REPORT_REFERENCE}}': reportReference
  });

  for (let index = 0; index < ONEWEB.MAX_ACTION_GROUPS; index += 1) {
    const prefix = 'P' + (index + 1);
    const group = groups[index];

    if (!group) {
      removeActionCardAndCollapse_(
        slide,
        '{{' + prefix + '_NUMBER}}'
      );
      continue;
    }

    replaceSlideText_(slide, {
      ['{{' + prefix + '_NUMBER}}']:
        String(index + 1).padStart(2, '0'),
      ['{{' + prefix + '_TITLE}}']:
        truncateSlideText_(
          group.actionPlanTitle,
          ONEWEB.TEXT_LIMITS.ACTION_TITLE
        ),
      ['{{' + prefix + '_BODY}}']:
        truncateSlideText_(
          group.instruction,
          ONEWEB.TEXT_LIMITS.ACTION_BODY
        )
    });
  }
}


function buildRemainingFindingsSummary_(findings) {
  const remaining = findings.slice(ONEWEB.MAX_DISPLAYED_FINDINGS);

  if (!remaining.length) {
    return {
      displayCount: 'ALL',
      countLabel: 'IDENTIFIED CATEGORIES',
      critical: '—',
      serious: '—',
      moderate: '—',
      minor: '—',
      title: 'ALL IDENTIFIED CATEGORIES SHOWN',
      body:
        'Every issue category detected in this screening is shown on Pages 1–2.'
    };
  }

  return {
    displayCount: String(remaining.length),
    countLabel: 'ADDITIONAL CATEGORIES',
    critical: String(countSeverity_(remaining, 'Critical')),
    serious: String(countSeverity_(remaining, 'Serious')),
    moderate: String(countSeverity_(remaining, 'Moderate')),
    minor: String(countSeverity_(remaining, 'Minor')),
    title: 'ADDITIONAL CATEGORIES IDENTIFIED',
    body:
      'This snapshot displays the seven highest-priority issue categories. Complete findings are retained by OneWeb and are available upon request.'
  };
}

function collectTemplateIconBlobs_(slides) {
  const icons = {};

  slides.forEach(function (slide) {
    slide.getImages().forEach(function (image) {
      const title = String(image.getTitle() || '')
        .trim()
        .toUpperCase();

      if (title.indexOf('ICON_') !== 0) {
        return;
      }

      const key = title.slice(5);

      try {
        icons[key] = image.getBlob();
      } catch (error) {
        console.warn(
          'Could not load template icon ' + title + ': ' + cleanError_(error)
        );
      }
    });
  });

  return icons;
}

function replaceIconPlaceholder_(
  slide,
  token,
  iconKey,
  iconBlobs,
  actionTitle
) {
  const marker = findPageElementContainingText_(slide, token);

  if (!marker) {
    return;
  }

  const key = String(iconKey || 'DEFAULT').trim().toUpperCase();
  const blob = iconBlobs[key] || iconBlobs.DEFAULT;

  if (
    marker.getPageElementType() !==
    SlidesApp.PageElementType.SHAPE
  ) {
    return;
  }

  if (!blob) {
    marker.asShape().getText().setText('');
    return;
  }

  const image = marker.asShape().replaceWithImage(blob, false);
  image.setTitle(actionTitle + ' icon');
  image.setDescription(
    'Decorative icon representing the remediation action: ' + actionTitle + '.'
  );
}

function findPageElementByTitle_(slide, targetTitle) {
  const expected = String(targetTitle || '').trim().toUpperCase();
  const elements = flattenPageElements_(slide.getPageElements());

  for (let index = 0; index < elements.length; index += 1) {
    let title = '';

    try {
      title = String(elements[index].getTitle() || '')
        .trim()
        .toUpperCase();
    } catch (error) {
      title = '';
    }

    if (title === expected) {
      return elements[index];
    }
  }

  return null;
}

function findContainingGroupForElementTitle_(slide, targetTitle) {
  const element = findPageElementByTitle_(slide, targetTitle);

  if (!element) {
    return null;
  }

  let parent = element.getParentGroup();

  if (!parent) {
    return null;
  }

  while (parent.getParentGroup()) {
    parent = parent.getParentGroup();
  }

  return parent;
}

function removePage1FindingCard_(slide, prefix) {
  const accentTitle = prefix + '_SEVERITY_ACCENT';
  const accent = findPageElementByTitle_(slide, accentTitle);

  if (!accent) {
    throw new Error(
      'The Page 1 template is missing the shape titled ' +
      accentTitle + '.'
    );
  }

  const groupedCard = findContainingGroupForElementTitle_(
    slide,
    accentTitle
  );

  if (groupedCard) {
    groupedCard.remove();
    return;
  }

  removeUngroupedPage1CardRegion_(slide, prefix, accent);
}


function removeUngroupedPage1CardRegion_(slide, prefix, accent) {
  const accentElements = [1, 2, 3].map(function (number) {
    return findPageElementByTitle_(
      slide,
      'F' + number + '_SEVERITY_ACCENT'
    );
  }).filter(function (element) {
    return Boolean(element);
  }).sort(function (a, b) {
    return a.getLeft() - b.getLeft();
  });

  const currentIndex = accentElements.findIndex(function (element) {
    return element.getObjectId() === accent.getObjectId();
  });

  if (currentIndex === -1) {
    throw new Error(
      'Could not determine the Page 1 card region for ' + prefix + '.'
    );
  }

  const currentCenter = accent.getLeft() + accent.getWidth() / 2;
  const previousCenter = currentIndex > 0
    ? accentElements[currentIndex - 1].getLeft() +
      accentElements[currentIndex - 1].getWidth() / 2
    : Number.NEGATIVE_INFINITY;
  const nextCenter = currentIndex < accentElements.length - 1
    ? accentElements[currentIndex + 1].getLeft() +
      accentElements[currentIndex + 1].getWidth() / 2
    : Number.POSITIVE_INFINITY;

  const leftBoundary = isFinite(previousCenter)
    ? (previousCenter + currentCenter) / 2
    : Number.NEGATIVE_INFINITY;
  const rightBoundary = isFinite(nextCenter)
    ? (currentCenter + nextCenter) / 2
    : Number.POSITIVE_INFINITY;

  const regionTop = accent.getTop() - 12;
  const limitationMarker = findPageElementContainingText_(
    slide,
    'Counts reflect potential barrier instances'
  );
  const regionBottom = limitationMarker
    ? getTopLevelPageElement_(limitationMarker).getTop() - 1
    : Number.POSITIVE_INFINITY;

  slide.getPageElements().slice().forEach(function (element) {
    const centerX = element.getLeft() + element.getWidth() / 2;
    const centerY = element.getTop() + element.getHeight() / 2;

    if (
      centerX > leftBoundary &&
      centerX < rightBoundary &&
      centerY >= regionTop &&
      centerY < regionBottom
    ) {
      element.remove();
    }
  });
}

function populatePage1DetailFields_(slide, findings) {
  const fieldDefinitions = [
    {
      suffix: 'IMPACT',
      tokens: [
        '{{F1_IMPACT}}',
        '{{F2_IMPACT}}',
        '{{F3_IMPACT}}'
      ],
      limit: ONEWEB.TEXT_LIMITS.FINDING_IMPACT,
      value: function (finding) {
        return sanitizeReportLanguage_(
          finding.impact ||
          finding.description ||
          'The detected issue may create a barrier for some visitors.'
        );
      }
    },
    {
      suffix: 'ACTION',
      tokens: [
        '{{F1_ACTION}}',
        '{{F2_ACTION}}',
        '{{F3_ACTION}}'
      ],
      limit: ONEWEB.TEXT_LIMITS.FINDING_ACTION,
      value: function (finding) {
        return sanitizeReportLanguage_(
          finding.action ||
          'Review the affected content and correct the underlying issue.'
        );
      }
    }
  ];

  fieldDefinitions.forEach(function (definition) {
    const shapes = findShapesContainingAnyToken_(
      slide,
      definition.tokens
    ).sort(function (a, b) {
      const leftDifference = a.getLeft() - b.getLeft();
      return leftDifference || a.getTop() - b.getTop();
    });

    if (shapes.length < findings.length) {
      throw new Error(
        'Page 1 does not contain enough ' +
        definition.suffix.toLowerCase() +
        ' text slots for the displayed findings.'
      );
    }

    shapes.forEach(function (shape, index) {
      const finding = findings[index];
      const replacement = finding
        ? truncateSlideText_(
            definition.value(finding),
            definition.limit
          )
        : '';
      const textRange = shape.asShape().getText();

      definition.tokens.forEach(function (token) {
        textRange.replaceAllText(token, replacement);
      });
    });
  });
}

function findShapesContainingAnyToken_(slide, tokens) {
  const elements = flattenPageElements_(slide.getPageElements());
  const matches = [];

  elements.forEach(function (element) {
    if (
      element.getPageElementType() !==
      SlidesApp.PageElementType.SHAPE
    ) {
      return;
    }

    try {
      const text = element.asShape().getText().asString();

      if (tokens.some(function (token) {
        return text.indexOf(token) !== -1;
      })) {
        matches.push(element);
      }
    } catch (error) {
      // Ignore shapes without readable text.
    }
  });

  return matches;
}

function countSlideTokenOccurrences_(slide, tokens) {
  let count = 0;
  const elements = flattenPageElements_(slide.getPageElements());

  elements.forEach(function (element) {
    if (
      element.getPageElementType() !==
      SlidesApp.PageElementType.SHAPE
    ) {
      return;
    }

    try {
      const text = element.asShape().getText().asString();

      tokens.forEach(function (token) {
        let start = 0;
        let index;

        while ((index = text.indexOf(token, start)) !== -1) {
          count += 1;
          start = index + token.length;
        }
      });
    } catch (error) {
      // Ignore shapes without readable text.
    }
  });

  return count;
}

function findCardBackgroundContainingElement_(slide, anchor) {
  const centerX = anchor.getLeft() + anchor.getWidth() / 2;
  const centerY = anchor.getTop() + anchor.getHeight() / 2;
  const minimumWidth = anchor.getWidth() * 3;
  const minimumHeight = anchor.getHeight() * 2;
  const candidates = [];

  slide.getPageElements().forEach(function (element) {
    if (
      element.getObjectId() === anchor.getObjectId() ||
      element.getPageElementType() !==
        SlidesApp.PageElementType.SHAPE
    ) {
      return;
    }

    const left = element.getLeft();
    const top = element.getTop();
    const right = left + element.getWidth();
    const bottom = top + element.getHeight();

    if (
      element.getWidth() >= minimumWidth &&
      element.getHeight() >= minimumHeight &&
      centerX >= left &&
      centerX <= right &&
      centerY >= top &&
      centerY <= bottom
    ) {
      candidates.push(element);
    }
  });

  candidates.sort(function (a, b) {
    const areaA = a.getWidth() * a.getHeight();
    const areaB = b.getWidth() * b.getHeight();
    return areaA - areaB;
  });

  return candidates.length ? candidates[0] : null;
}

function clearActionSlotTokens_(slide, numberToken) {
  const match = String(numberToken || '').match(/\{\{(P\d+)_NUMBER\}\}/);
  const prefix = match ? match[1] : '';

  if (!prefix) {
    return;
  }

  replaceSlideText_(slide, {
    ['{{' + prefix + '_NUMBER}}']: '',
    ['{{' + prefix + '_TITLE}}']: '',
    ['{{' + prefix + '_BODY}}']: ''
  });
}

function removeGroupedTemplateSlot_(slide, numberToken) {
  const group = findContainingGroupForToken_(slide, numberToken);

  if (!group) {
    throw new Error(
      'The template card containing ' + numberToken +
      ' must be grouped before the script can remove it.'
    );
  }

  group.remove();
}

function removeActionCardAndCollapse_(slide, numberToken) {
  const marker = findPageElementContainingText_(slide, numberToken);

  if (!marker) {
    return;
  }

  const group = findContainingGroupForToken_(slide, numberToken);

  if (group) {
    group.remove();
    return;
  }

  const markerElement = getTopLevelPageElement_(marker);
  const cardBackground = findCardBackgroundContainingElement_(
    slide,
    markerElement
  );

  if (!cardBackground) {
    clearActionSlotTokens_(slide, numberToken);
    return;
  }

  const cardTop = cardBackground.getTop();
  const cardBottom = cardTop + cardBackground.getHeight();
  const cardLeft = cardBackground.getLeft();
  const cardRight = cardLeft + cardBackground.getWidth();

  const markerTop = markerElement.getTop();
  const remainingMarkers = [
    '{{P1_NUMBER}}',
    '{{P2_NUMBER}}',
    '{{P3_NUMBER}}',
    '{{P4_NUMBER}}'
  ].map(function (token) {
    const element = findPageElementContainingText_(slide, token);
    return element ? getTopLevelPageElement_(element) : null;
  }).filter(function (element) {
    return Boolean(element);
  }).sort(function (a, b) {
    return a.getTop() - b.getTop();
  });

  let nextMarkerTop = Number.POSITIVE_INFINITY;

  remainingMarkers.forEach(function (element) {
    if (
      element.getTop() > markerTop + 1 &&
      element.getTop() < nextMarkerTop
    ) {
      nextMarkerTop = element.getTop();
    }
  });

  const shift = isFinite(nextMarkerTop)
    ? nextMarkerTop - markerTop
    : 0;

  const validationMarker = findPageElementContainingText_(
    slide,
    'VALIDATE THE CORRECTIONS AND RETEST'
  );
  const validationTop = validationMarker
    ? getTopLevelPageElement_(validationMarker).getTop()
    : Number.POSITIVE_INFINITY;

  const elements = slide.getPageElements().slice();
  const removeIds = {};

  elements.forEach(function (element) {
    const centerX = element.getLeft() + element.getWidth() / 2;
    const centerY = element.getTop() + element.getHeight() / 2;

    if (
      centerX >= cardLeft - 2 &&
      centerX <= cardRight + 2 &&
      centerY >= cardTop - 2 &&
      centerY <= cardBottom + 2
    ) {
      removeIds[element.getObjectId()] = true;
    }
  });

  elements.forEach(function (element) {
    if (removeIds[element.getObjectId()]) {
      element.remove();
    }
  });

  if (shift <= 0) {
    return;
  }

  slide.getPageElements().forEach(function (element) {
    const top = element.getTop();

    if (
      top >= cardBottom - 1 &&
      top < validationTop - 1
    ) {
      element.setTop(top - shift);
    }
  });
}


function replaceSlideText_(slide, replacements) {
  Object.keys(replacements).forEach(function (token) {
    slide.replaceAllText(
      token,
      String(
        replacements[token] == null
          ? ''
          : replacements[token]
      )
    );
  });
}

function fillFindingSlot_(
  slide,
  prefix,
  finding,
  number,
  reviewedPageCount
) {
  applySeverityStyle_(slide, prefix, finding.severity);

  const count = Math.max(Number(finding.count) || 0, 0);

  replaceSlideText_(slide, {
    ['{{' + prefix + '_NUMBER}}']:
      String(number).padStart(2, '0'),
    ['{{' + prefix + '_TITLE}}']:
      truncateSlideText_(
        String(finding.title || 'Accessibility issue'),
        ONEWEB.TEXT_LIMITS.FINDING_TITLE
      ),
    ['{{' + prefix + '_SEVERITY}}']:
      normalizeSeverity_(finding.severity).toUpperCase(),
    ['{{' + prefix + '_COUNT}}']:
      prefix === 'F1' || prefix === 'F2' || prefix === 'F3'
        ? String(count)
        : String(count) + ' potential instances',
    ['{{' + prefix + '_PAGE_COVERAGE}}']:
      formatPageCoverage_(finding, reviewedPageCount),
    ['{{' + prefix + '_MOST_AFFECTED_PAGE}}']:
      truncateSlideText_(
        formatMostAffectedPage_(finding),
        ONEWEB.TEXT_LIMITS.MOST_AFFECTED_PAGE
      ),
    ['{{' + prefix + '_LOCATION}}']:
      formatObservedLocations_(finding.pages)
  });
}


function removeTemplateSlot_(
  slide,
  numberToken,
  topPadding,
  rowHeight
) {
  const marker = findPageElementContainingText_(
    slide,
    numberToken
  );

  if (!marker) {
    return;
  }

  const regionTop =
    marker.getTop() - topPadding;
  const regionBottom =
    regionTop + rowHeight;

  slide.getPageElements()
    .slice()
    .forEach(function (element) {
      const top = element.getTop();
      const bottom =
        top + element.getHeight();

      if (
        top >= regionTop - 1 &&
        bottom <= regionBottom + 1
      ) {
        element.remove();
      }
    });
}

function findPageElementContainingText_(slide, token) {
  const elements = flattenPageElements_(
    slide.getPageElements()
  );

  for (let i = 0; i < elements.length; i += 1) {
    const element = elements[i];
    const type = element.getPageElementType();

    if (type === SlidesApp.PageElementType.SHAPE) {
      try {
        const text = element
          .asShape()
          .getText()
          .asString();

        if (text.indexOf(token) !== -1) {
          return element;
        }
      } catch (error) {
        // This shape does not contain readable text.
      }
    }

    if (type === SlidesApp.PageElementType.TABLE) {
      try {
        const table = element.asTable();

        for (let row = 0; row < table.getNumRows(); row += 1) {
          for (
            let column = 0;
            column < table.getNumColumns();
            column += 1
          ) {
            const text = table
              .getCell(row, column)
              .getText()
              .asString();

            if (text.indexOf(token) !== -1) {
              return element;
            }
          }
        }
      } catch (error) {
        // This table could not be read.
      }
    }
  }

  return null;
}

function formatObservedLocations_(pages) {
  const labels = unique_(
    Array.isArray(pages) ? pages : []
  ).map(function (url) {
    const normalized = String(url || '')
      .replace(/[?#].*$/, '');

    const path = normalized
      .replace(/^https?:\/\/[^/]+/i, '')
      .replace(/^\/+|\/+$/g, '');

    if (!path) {
      return 'Homepage';
    }

    const segment =
      path.split('/').filter(Boolean).pop() ||
      'page';

    const words = segment
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, function (character) {
        return character.toUpperCase();
      });

    return (
      words +
      (
        /(page|form|homepage)$/i.test(words)
          ? ''
          : ' page'
      )
    );
  });

  if (!labels.length) {
    return 'Reviewed page';
  }

  if (labels.length === 1) {
    return labels[0];
  }

  if (labels.length === 2) {
    return labels[0] + ' and ' + labels[1];
  }

  return (
    labels.slice(0, -1).join(', ') +
    ' and ' +
    labels[labels.length - 1]
  );
}

function formatReviewedPages_(pages) {
  const labels = unique_(
    Array.isArray(pages) ? pages : []
  ).map(function (url) {
    const cleanUrl = String(url || '')
      .replace(/[?#].*$/, '');

    const path = cleanUrl
      .replace(/^https?:\/\/[^/]+/i, '')
      .replace(/^\/+|\/+$/g, '');

    if (!path) {
      return 'Homepage';
    }

    return path
      .split('/')
      .filter(Boolean)
      .map(function (segment) {
        let decodedSegment = segment;

        try {
          decodedSegment = decodeURIComponent(segment);
        } catch (error) {
          // Keep the encoded segment when decoding fails.
        }

        return decodedSegment
          .replace(/\.[a-z0-9]+$/i, '')
          .replace(/[-_]+/g, ' ')
          .replace(/\b\w/g, function (character) {
            return character.toUpperCase();
          });
      })
      .join(' › ');
  });

  if (!labels.length) {
    return 'No reviewed pages recorded';
  }

  if (labels.length === 1) {
    return labels[0];
  }

  return labels.join(', ');
}

function buildSlidesActionSteps_(scan) {
  return groupFindingsForActionPlan_(
    scan.findings,
    scan.successfulPages.length
  ).slice(0, ONEWEB.MAX_ACTION_GROUPS);
}

function actionTitleForFinding_(finding) {
  const metadata = resolveAuditActionMetadata_(
    finding && finding.id,
    finding || {}
  );

  return metadata.actionPlanTitle;
}

function buildReportReference_(organizationName) {
  const stamp = Utilities.formatDate(
    new Date(),
    ONEWEB.TIME_ZONE,
    'yyyyMMdd'
  );

  const code = String(
    organizationName || 'ORG'
  )
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 12) || 'ORG';

  return 'OWS-' + stamp + '-' + code;
}

function compareFindings_(a, b) {
  const scoreDifference =
    Number(b.priorityScore || 0) -
    Number(a.priorityScore || 0);

  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  const pageDifference =
    Number(b.affectedPageCount || 0) -
    Number(a.affectedPageCount || 0);

  if (pageDifference !== 0) {
    return pageDifference;
  }

  const countDifference =
    Number(b.count || 0) -
    Number(a.count || 0);

  if (countDifference !== 0) {
    return countDifference;
  }

  return String(a.title || '')
    .localeCompare(String(b.title || ''));
}

function countSeverity_(findings, severity) {
  return findings.filter(function (finding) {
    return finding.severity === severity;
  }).length;
}

function findingSummary_(finding) {
  if (!finding) {
    return '';
  }

  return (
    finding.title +
    ' — ' +
    finding.severity +
    ' — ' +
    finding.count +
    ' instance' +
    (
      finding.count === 1
        ? ''
        : 's'
    )
  );
}

function normalizeSeverity_(severity) {
  const value = String(
    severity || ''
  ).trim().toLowerCase();

  if (value === 'critical') {
    return 'Critical';
  }

  if (value === 'serious') {
    return 'Serious';
  }

  if (value === 'moderate') {
    return 'Moderate';
  }

  if (value === 'minor') {
    return 'Minor';
  }

  return 'Minor';
}

function defaultAuditActionMetadata_(auditId) {
  const normalizedId = String(auditId || '')
    .trim()
    .replace(/-\d+$/, '');
  const groupKey =
    ONEWEB_AUDIT_GROUP_MAP[normalizedId] ||
    'GENERAL';
  const definition =
    ONEWEB_ACTION_GROUPS[groupKey] ||
    ONEWEB_ACTION_GROUPS.GENERAL;

  return {
    actionGroupKey: groupKey,
    actionGroup: definition.name,
    actionPlanTitle: definition.title,
    actionIconKey: definition.iconKey,
    verificationCheck: definition.verificationCheck,
    validationKeys: definition.validationKeys.slice(),
    instruction: definition.instruction
  };
}

function resolveAuditActionMetadata_(auditId, libraryItem) {
  const defaults = defaultAuditActionMetadata_(auditId);
  const actionGroup = String(
    libraryItem.actionGroup || defaults.actionGroup
  ).trim();
  const definition = getActionGroupDefinition_(actionGroup) ||
    ONEWEB_ACTION_GROUPS[defaults.actionGroupKey] ||
    ONEWEB_ACTION_GROUPS.GENERAL;

  return {
    actionGroupKey: getActionGroupKey_(actionGroup) || defaults.actionGroupKey,
    actionGroup: actionGroup || definition.name,
    actionPlanTitle: String(
      libraryItem.actionPlanTitle ||
      definition.title ||
      defaults.actionPlanTitle
    ).trim(),
    actionIconKey: String(
      libraryItem.actionIconKey ||
      definition.iconKey ||
      defaults.actionIconKey
    ).trim().toUpperCase(),
    verificationCheck: String(
      libraryItem.verificationCheck ||
      definition.verificationCheck ||
      defaults.verificationCheck
    ).trim(),
    validationKeys:
      (definition.validationKeys || defaults.validationKeys || []).slice(),
    instruction:
      definition.instruction || defaults.instruction
  };
}

function getActionGroupKey_(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  const keys = Object.keys(ONEWEB_ACTION_GROUPS);

  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const definition = ONEWEB_ACTION_GROUPS[key];

    if (
      key.toLowerCase() === normalized ||
      definition.name.toLowerCase() === normalized
    ) {
      return key;
    }
  }

  return '';
}

function getActionGroupDefinition_(value) {
  const key = getActionGroupKey_(value);
  return key ? ONEWEB_ACTION_GROUPS[key] : null;
}

function getCellByHeader_(row, headerMap, header, fallbackIndex) {
  const index = headerMap[header];

  if (index != null) {
    return row[index];
  }

  return row[fallbackIndex];
}

function severityPoints_(severity) {
  return ONEWEB.SEVERITY_POINTS[
    normalizeSeverity_(severity)
  ] || 0;
}

function instanceVolumePoints_(count) {
  const value = Math.max(Number(count) || 0, 0);

  if (value >= 50) return 20;
  if (value >= 25) return 16;
  if (value >= 10) return 12;
  if (value >= 5) return 8;
  if (value >= 2) return 5;
  if (value === 1) return 2;

  return 0;
}

function calculatePriorityScore_(finding, reviewedPageCount) {
  const affectedPages = Number(
    finding.affectedPageCount ||
    (finding.pages ? unique_(finding.pages).length : 0)
  );

  const coveragePoints = reviewedPageCount > 0
    ? Math.round(
        50 * affectedPages / reviewedPageCount
      )
    : 0;

  return (
    severityPoints_(finding.severity) +
    coveragePoints +
    instanceVolumePoints_(finding.count)
  );
}

function buildRankReason_(finding, reviewedPageCount) {
  const severity = normalizeSeverity_(finding.severity);
  const affected = Number(finding.affectedPageCount || 0);

  return (
    'Prioritized because it is ' +
    severity +
    ' and was detected on ' +
    affected +
    ' of ' +
    reviewedPageCount +
    ' reviewed page' +
    (reviewedPageCount === 1 ? '' : 's') +
    '.'
  );
}

function getMostAffectedPage_(finding) {
  const entries = Object.keys(finding.pageCounts || {})
    .map(function (url) {
      return [url, Number(finding.pageCounts[url]) || 0];
    });

  if (!entries.length) {
    return finding.pages && finding.pages.length
      ? finding.pages[0]
      : '';
  }

  entries.sort(function (a, b) {
    const difference = b[1] - a[1];
    return difference || String(a[0]).localeCompare(String(b[0]));
  });

  return entries[0][0];
}

function formatMostAffectedPage_(finding) {
  const url = String(
    finding.mostAffectedPage ||
    getMostAffectedPage_(finding) ||
    ''
  ).replace(/[?#].*$/, '');

  if (!url) {
    return 'Reviewed page';
  }

  let path = url.replace(/^https?:\/\/[^/]+/i, '');

  if (!path || path === '/') {
    return 'Homepage';
  }

  try {
    path = decodeURIComponent(path);
  } catch (error) {
    // Retain the encoded path.
  }

  path = path.replace(/\/+$/, '');

  return path || 'Homepage';
}

function formatPageCoverage_(finding, reviewedPageCount) {
  const affected = Number(
    finding.affectedPageCount ||
    (finding.pages ? unique_(finding.pages).length : 0)
  );

  return (
    affected +
    ' of ' +
    reviewedPageCount +
    ' reviewed page' +
    (reviewedPageCount === 1 ? '' : 's')
  );
}

function groupFindingsForActionPlan_(findings, reviewedPageCount) {
  const groupsByKey = {};

  findings.forEach(function (finding) {
    const metadata = resolveAuditActionMetadata_(
      finding.sourceAuditId || finding.id,
      finding
    );
    const groupKey = metadata.actionGroupKey || 'GENERAL';
    const definition =
      ONEWEB_ACTION_GROUPS[groupKey] ||
      ONEWEB_ACTION_GROUPS.GENERAL;

    if (!groupsByKey[groupKey]) {
      groupsByKey[groupKey] = {
        actionGroupKey: groupKey,
        actionGroup: metadata.actionGroup || definition.name,
        actionPlanTitle: metadata.actionPlanTitle || definition.title,
        actionIconKey: metadata.actionIconKey || definition.iconKey,
        highestSeverity: normalizeSeverity_(finding.severity),
        totalInstances: 0,
        affectedPages: [],
        categoryCount: 0,
        findings: [],
        verificationChecks: [],
        validationKeys: [],
        instruction: definition.instruction,
        groupScore: 0
      };
    }

    const group = groupsByKey[groupKey];
    group.totalInstances += Math.max(Number(finding.count) || 0, 0);
    group.affectedPages = unique_(
      group.affectedPages.concat(finding.pages || [])
    );
    group.categoryCount += 1;
    group.findings.push(finding);
    group.verificationChecks = unique_(
      group.verificationChecks.concat(
        finding.verificationCheck
          ? [finding.verificationCheck]
          : []
      )
    );
    group.validationKeys = unique_(
      group.validationKeys.concat(
        finding.validationKeys || definition.validationKeys || []
      )
    );

    if (
      severityPoints_(finding.severity) >
      severityPoints_(group.highestSeverity)
    ) {
      group.highestSeverity = normalizeSeverity_(finding.severity);
    }
  });

  return Object.keys(groupsByKey)
    .map(function (key) {
      const group = groupsByKey[key];
      group.findings.sort(compareFindings_);

      if (key === 'GENERAL' && group.findings.length) {
        group.instruction = sanitizeReportLanguage_(
          group.findings[0].action ||
          ONEWEB_ACTION_GROUPS.GENERAL.instruction
        );
      }

      group.groupScore = calculateActionGroupScore_(
        group,
        reviewedPageCount
      );
      return group;
    })
    .sort(function (a, b) {
      const scoreDifference = b.groupScore - a.groupScore;
      if (scoreDifference !== 0) return scoreDifference;

      const pageDifference =
        b.affectedPages.length - a.affectedPages.length;
      if (pageDifference !== 0) return pageDifference;

      const countDifference = b.totalInstances - a.totalInstances;
      if (countDifference !== 0) return countDifference;

      return String(a.actionPlanTitle || '')
        .localeCompare(String(b.actionPlanTitle || ''));
    });
}

function calculateActionGroupScore_(group, reviewedPageCount) {
  const coveragePoints = reviewedPageCount > 0
    ? Math.round(
        50 * group.affectedPages.length /
        reviewedPageCount
      )
    : 0;
  const relatedCategoryBonus = Math.min(
    12,
    Math.max(group.categoryCount - 1, 0) * 3
  );

  return (
    severityPoints_(group.highestSeverity) +
    coveragePoints +
    instanceVolumePoints_(group.totalInstances) +
    relatedCategoryBonus
  );
}

function buildValidationAndRetestText_(findings) {
  const validationKeys = [];

  findings.forEach(function (finding) {
    const metadata = resolveAuditActionMetadata_(
      finding.sourceAuditId || finding.id,
      finding
    );

    (metadata.validationKeys || []).forEach(function (key) {
      if (validationKeys.indexOf(key) === -1) {
        validationKeys.push(key);
      }
    });
  });

  const methods = [];

  if (validationKeys.indexOf('KEYBOARD') !== -1) {
    methods.push('keyboard-only navigation and focus-order review');
  }

  if (validationKeys.indexOf('SCREEN_READER') !== -1) {
    methods.push('screen-reader testing');
  }

  if (validationKeys.indexOf('VISUAL') !== -1) {
    methods.push('contrast, 200% zoom, and reflow testing');
  }

  if (validationKeys.indexOf('MEDIA') !== -1) {
    methods.push('caption, transcript, and media-control review');
  }

  if (validationKeys.indexOf('FORMS') !== -1) {
    methods.push('form-label, instruction, error, and status-message review');
  }

  if (validationKeys.indexOf('TABLES') !== -1) {
    methods.push('table-header and navigation review');
  }

  if (validationKeys.indexOf('TOUCH') !== -1) {
    methods.push('mobile and touch-device testing');
  }

  let methodText;

  if (!methods.length) {
    methodText = 'the relevant keyboard, screen-reader, and visual checks';
  } else if (methods.length === 1) {
    methodText = methods[0];
  } else if (methods.length === 2) {
    methodText = methods[0] + ' and ' + methods[1];
  } else {
    methodText =
      methods.slice(0, 2).join(', ') +
      ', and other checks relevant to the detected findings';
  }

  return truncateSlideText_(
    'Manually test the affected pages using ' + methodText +
    '. Fix remaining issues, then rerun the automated screening to confirm improvement.',
    ONEWEB.TEXT_LIMITS.VALIDATION_TEXT
  );
}

function applySeverityStyle_(slide, prefix, severity) {
  const normalized = normalizeSeverity_(severity);
  const accentColor = ONEWEB.SEVERITY_COLORS[normalized];
  const backgroundColor =
    ONEWEB.SEVERITY_BACKGROUND_COLORS[normalized];

  if (!accentColor) {
    return;
  }

  /*
   * The number/severity panel always uses the main severity color.
   */
  recolorShapeFillByTitle_(
    slide,
    prefix + '_SEVERITY_ACCENT',
    accentColor
  );

  /*
   * Page 1:
   * - the two icon circles match the severity panel exactly
   * - the two divider lines match the severity panel exactly
   * - the card background uses the corresponding pale severity color
   * - black outlines and shadows remain unchanged
   */
  if (/^F[1-3]$/.test(prefix)) {
    recolorShapeFillByTitle_(
      slide,
      prefix + '_IMPACT_ACCENT',
      accentColor
    );

    recolorShapeFillByTitle_(
      slide,
      prefix + '_ACTION_ACCENT',
      accentColor
    );

    recolorShapeFillByTitle_(
      slide,
      prefix + '_CARD_BACKGROUND',
      backgroundColor
    );

    recolorLineOrThinShapeByTitle_(
      slide,
      prefix + '_TOP_DIVIDER',
      accentColor
    );

    recolorLineOrThinShapeByTitle_(
      slide,
      prefix + '_BOTTOM_DIVIDER',
      accentColor
    );
  }

  /*
   * Page 2:
   * the three metric circles match the severity panel exactly.
   */
  if (/^F[4-7]$/.test(prefix)) {
    recolorShapeFillByTitle_(
      slide,
      prefix + '_COUNT_ACCENT',
      accentColor
    );

    recolorShapeFillByTitle_(
      slide,
      prefix + '_PAGE_COVERAGE_ACCENT',
      accentColor
    );

    recolorShapeFillByTitle_(
      slide,
      prefix + '_MOST_AFFECTED_ACCENT',
      accentColor
    );
  }
}

function recolorShapeFillByTitle_(slide, title, color) {
  const element = findPageElementByTitle_(slide, title);

  if (!element) {
    throw new Error(
      'The Slides template is missing an element with alt-text title ' +
      title + '.'
    );
  }

  if (
    element.getPageElementType() !==
    SlidesApp.PageElementType.SHAPE
  ) {
    throw new Error(
      'The element titled ' + title +
      ' must be an editable Google Slides shape.'
    );
  }

  /*
   * Change only the fill so existing black borders and shadows remain.
   */
  element
    .asShape()
    .getFill()
    .setSolidFill(color);
}

function recolorLineOrThinShapeByTitle_(slide, title, color) {
  const element = findPageElementByTitle_(slide, title);

  if (!element) {
    throw new Error(
      'The Slides template is missing an element with alt-text title ' +
      title + '.'
    );
  }

  const type = element.getPageElementType();

  /*
   * Native Google Slides line.
   */
  if (type === SlidesApp.PageElementType.LINE) {
    element
      .asLine()
      .getLineFill()
      .setSolidFill(color);
    return;
  }

  /*
   * PowerPoint imports often convert a visual line into a very thin shape.
   * In that case, recolor only the fill.
   */
  if (type === SlidesApp.PageElementType.SHAPE) {
    element
      .asShape()
      .getFill()
      .setSolidFill(color);
    return;
  }

  throw new Error(
    'The element titled ' + title +
    ' must be an editable Google Slides line or thin shape.'
  );
}

function sanitizeReportLanguage_(value) {
  return String(value || '')
    .replace(/\busers cannot\b/gi, 'users may not be able to')
    .replace(/\bcannot understand\b/gi, 'may miss or misunderstand')
    .replace(/\bviolations?\b/gi, 'potential issues')
    .replace(/\billegal\b/gi, 'potentially inconsistent with applicable requirements')
    .replace(/\bnoncompliant\b/gi, 'potentially nonconforming')
    .replace(/\bfailed WCAG\b/gi, 'was flagged by automated testing')
    .trim();
}

function truncateSlideText_(value, maximumLength) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!maximumLength || text.length <= maximumLength) {
    return text;
  }

  const candidate = text.slice(0, maximumLength + 1);
  const sentenceEnd = Math.max(
    candidate.lastIndexOf('. '),
    candidate.lastIndexOf('! '),
    candidate.lastIndexOf('? ')
  );

  if (sentenceEnd >= Math.floor(maximumLength * 0.6)) {
    return candidate.slice(0, sentenceEnd + 1).trim();
  }

  const wordEnd = candidate.lastIndexOf(' ');
  return (
    candidate.slice(0, wordEnd > 0 ? wordEnd : maximumLength).trim() +
    '…'
  );
}

function slideContainsToken_(slide, token) {
  return Boolean(findPageElementContainingText_(slide, token));
}

function findContainingGroupForToken_(slide, token) {
  const marker = findPageElementContainingText_(slide, token);

  if (!marker) {
    return null;
  }

  let parent = marker.getParentGroup();

  if (!parent) {
    return null;
  }

  while (parent.getParentGroup()) {
    parent = parent.getParentGroup();
  }

  return parent;
}

function getTopLevelPageElement_(element) {
  let current = element;
  let parent = current.getParentGroup();

  while (parent) {
    current = parent;
    parent = current.getParentGroup();
  }

  return current;
}

function flattenPageElements_(elements) {
  const flattened = [];

  elements.forEach(function (element) {
    flattened.push(element);

    if (
      element.getPageElementType() ===
      SlidesApp.PageElementType.GROUP
    ) {
      flattened.push.apply(
        flattened,
        flattenPageElements_(element.asGroup().getChildren())
      );
    }
  });

  return flattened;
}

function normalizeStartingUrl_(value) {
  let url = String(value || '').trim();

  if (!url) {
    return '';
  }

  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }

  return normalizeUrl_(url);
}

function normalizeUrl_(value) {
  const raw = String(value || '')
    .trim()
    .split('#')[0];

  const match = raw.match(
    /^(https?):\/\/([^/?#]+)([^?#]*)(\?[^#]*)?$/i
  );

  if (!match) {
    return '';
  }

  const protocol =
    match[1].toLowerCase();

  const host =
    match[2].toLowerCase();

  let pathname = match[3] || '/';

  const query =
    match[4] ? match[4].slice(1) : '';

  pathname = normalizePath_(pathname);

  if (pathname.length > 1) {
    pathname =
      pathname.replace(/\/+$/, '');
  }

  const blockedParameters = {
    utm_source: true,
    utm_medium: true,
    utm_campaign: true,
    utm_term: true,
    utm_content: true,
    gclid: true,
    fbclid: true
  };

  const keptQuery = query
    .split('&')
    .filter(function (part) {
      if (!part) {
        return false;
      }

      let name =
        part.split('=')[0] || '';

      try {
        name = decodeURIComponent(name);
      } catch (error) {
        // Keep the original parameter.
      }

      name = name.toLowerCase();

      return !blockedParameters[name];
    })
    .join('&');

  return (
    protocol +
    '://' +
    host +
    pathname +
    (
      keptQuery
        ? '?' + keptQuery
        : ''
    )
  );
}

function resolveUrl_(href, baseUrl) {
  const value = String(
    href || ''
  ).trim();

  if (!value) {
    return '';
  }

  if (/^https?:\/\//i.test(value)) {
    return normalizeUrl_(value);
  }

  const base = normalizeUrl_(baseUrl);
  const origin = getOrigin_(base);

  if (!origin) {
    return '';
  }

  if (/^\/\//.test(value)) {
    return normalizeUrl_(
      origin.split(':')[0] +
      ':' +
      value
    );
  }

  if (value.charAt(0) === '/') {
    return normalizeUrl_(origin + value);
  }

  if (value.charAt(0) === '?') {
    return normalizeUrl_(
      base.split('?')[0] + value
    );
  }

  const basePath =
    base.slice(origin.length)
      .split('?')[0] || '/';

  const directory = basePath.slice(
    0,
    basePath.lastIndexOf('/') + 1
  );

  return normalizeUrl_(
    origin + directory + value
  );
}

function normalizePath_(path) {
  const parts = String(
    path || '/'
  ).split('/');

  const normalized = [];

  parts.forEach(function (part) {
    if (!part || part === '.') {
      return;
    }

    if (part === '..') {
      normalized.pop();
      return;
    }

    normalized.push(part);
  });

  return '/' + normalized.join('/');
}

function getOrigin_(value) {
  const match = String(value || '').match(
    /^(https?):\/\/([^/?#]+)/i
  );

  return match
    ? match[1].toLowerCase() +
        '://' +
        match[2].toLowerCase()
    : '';
}


function toBoolean_(value) {
  return (
    value === true ||
    String(value || '')
      .trim()
      .toUpperCase() === 'TRUE'
  );
}

function boundedInt_(
  value,
  min,
  max,
  fallback
) {
  const parsed = parseInt(value, 10);

  if (isNaN(parsed)) {
    return fallback;
  }

  return Math.max(
    min,
    Math.min(max, parsed)
  );
}


function unique_(values) {
  return values.filter(
    function (value, index, array) {
      return array.indexOf(value) === index;
    }
  );
}

function safeFilename_(value) {
  const cleaned = String(value || '')
    .replace(/[\\/:*?"<>|#%{}[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    cleaned.slice(0, 80) ||
    'Organization'
  );
}

function htmlEscape_(value) {
  return String(
    value == null ? '' : value
  )
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanError_(error) {
  const message =
    error && error.message
      ? error.message
      : String(error || 'Unknown error');

  return message
    .replace(
      /\bkey=[^&\s]+/gi,
      'key=[REDACTED]'
    )
    .slice(0, 1000);
}

function affectedPageLabel_(finding) {
  const count =
    finding &&
    Array.isArray(finding.pages) &&
    finding.pages.length
      ? unique_(finding.pages).length
      : 1;

  return (
    count +
    ' reviewed page' +
    (count === 1 ? '' : 's')
  );
}

function ensureTerminalPunctuation_(value) {
  const text = String(value || '').trim();

  if (!text) {
    return '';
  }

  return /[.!?]$/.test(text)
    ? text
    : text + '.';
}


function createSlidePreviews_(config, presentationId, pageIds, fileStem) {
  const folder = DriveApp.getFolderById(config.reportPreviewsFolderId);
  const token = ScriptApp.getOAuthToken();

  return pageIds.map(function (pageId, index) {
    const url =
      'https://docs.google.com/presentation/d/' + presentationId +
      '/export/png?pageid=' + encodeURIComponent(pageId);
    const response = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true,
      followRedirects: true
    });

    if (response.getResponseCode() !== 200) {
      throw new Error('Google Slides could not render report preview page ' + (index + 1) + '.');
    }

    return folder.createFile(
      response.getBlob().setName(fileStem + '_Page_' + (index + 1) + '.png')
    );
  });
}
