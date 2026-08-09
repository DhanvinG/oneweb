# Lumen by OneWeb

Lumen is the three-screen public accessibility assessment flow shown in the supplied final templates:

1. Landing: one public URL field and one Analyze Website action.
2. Scan progress: five backend-linked stages.
3. Results: the three actual Google Slides report pages and one PDF download.

The frontend is in `src/`, the same-origin production proxy is in `api/lumen.ts`, and the standalone Google Apps Script backend is in `apps-script/Code.gs`. The public backend contains no outreach queue, email, draft, reply, follow-up, or prospect-data code.

## Local frontend

1. From the `lumen` directory, run `npm install`.
2. Copy `.env.example` to `.env.local` and enter the two server-only production values.
3. Run `npm run dev`.

The full scan requires a deployed Apps Script backend and a server environment capable of running `api/lumen.ts`. For end-to-end local testing, run the project with Vercel's local development command after setting the environment values.

## Lumen Google and Deployment Setup

### 1. Choose the production Google account

Use a dedicated OneWeb-controlled Google Workspace account, such as `lumen@oneweb.social`, rather than a personal account. That account should own the Apps Script project, the copied Slides template, the Audit Library spreadsheet, and all generated-output folders. Keep at least one additional OneWeb administrator as an editor for recovery.

### 2. Create the standalone Apps Script backend

1. Sign in as the production Lumen account and open [script.google.com](https://script.google.com).
2. Select **New project** and name it `Lumen Production Scanner`.
3. This must be a **standalone** Apps Script project; do not bind it to the outreach tracker or any organization queue.
4. Replace the default `Code.gs` with the complete contents of `apps-script/Code.gs` in this project.
5. In **Project Settings**, enable showing the `appsscript.json` manifest. Replace it with `apps-script/appsscript.json`.

The included source retains the supplied representative-page discovery, mobile PageSpeed accessibility scan, parallel `fetchAll` requests, automated-audit filtering, issue-instance counting, cross-page aggregation, coverage, severity, priority ranking, Audit Library action grouping, native three-slide template replacement, template-copy workflow, and Slides-to-PDF export. It adds only the public web endpoint, scan status, SSRF controls, quotas, and actual slide preview export.

### 3. Copy the exact three-slide report template

1. In the current account, open the existing native three-slide Google Slides template identified by the supplied script's `SLIDES_TEMPLATE_ID`.
2. Share it with the production Lumen account or place it in a temporarily shared folder.
3. While signed in as the production account, choose **File → Make a copy → Entire presentation**.
4. Name the production copy `Lumen Accessibility Report Template` and keep it in a private `Lumen Production` Drive folder.
5. Confirm it remains a native Google Slides file with exactly three slides and that all existing placeholder text, grouped cards, element alt-text titles, colors, and native objects remain unchanged.
6. From its URL, copy only the value between `/d/` and `/edit`. That is the new `SLIDES_TEMPLATE_ID`.
7. Add that ID as the `SLIDES_TEMPLATE_ID` Script Property. Do not paste it into the browser frontend.

### 4. Create the production Drive folders

Inside the production account's private `Lumen Production` folder, create these three folders:

- `Generated Slides`
- `Generated PDFs`
- `Report Previews`

Open each folder and copy the value after `/folders/` in its URL. Add those values to Script Properties as `GENERATED_SLIDES_FOLDER_ID`, `GENERATED_PDFS_FOLDER_ID`, and `REPORT_PREVIEWS_FOLDER_ID` respectively.

Generated report files and PNG previews are made viewable to anyone with the link so the public results screen can display and download them. The parent folders and source template stay private. Lumen's hourly cleanup moves generated files to Google Drive Trash after the configured 24-hour retention period; the template and Audit Library are never included.

### 5. Create the standalone Audit Library source

1. Create a new Google Spreadsheet named `Lumen Audit Library` in the production account.
2. Copy only the existing `Audit Library` tab from the current OneWeb Outreach Tracker into this spreadsheet. Do not copy organization, settings, logs, or outreach tabs.
3. Keep the tab name exactly `Audit Library`.
4. Preserve header row 2 and data starting on row 3.
5. Confirm these columns exist exactly: `Audit ID`, `Friendly Title`, `Impact`, `What This Means`, `Recommended Action`, `Priority`, `Automated`, `WCAG Reference`, `Action Group`, `Action Plan Title`, `Action Icon Key`, and `Verification Check`.
6. Copy the spreadsheet ID between `/d/` and `/edit` and save it as `AUDIT_LIBRARY_SPREADSHEET_ID` in Script Properties.

This preserves the existing deterministic mappings; Lumen does not generate recommendations with an LLM.

### 6. Configure PageSpeed Insights

1. In [Google Cloud Console](https://console.cloud.google.com), select or create a project owned by the production OneWeb account.
2. Enable the **PageSpeed Insights API**.
3. Create an API key under **APIs & Services → Credentials**.
4. Restrict the key to the PageSpeed Insights API. Because Apps Script outbound IP addresses are shared, use the API restriction rather than an HTTP referrer restriction.
5. Save the key as the `PAGESPEED_API_KEY` Script Property.
6. In the Cloud project's quotas page, set alerts appropriate to the selected daily limit.

The backend always uses the `mobile` strategy and scans no more than five pages in parallel.

### 7. Add every required Script Property

In Apps Script, open **Project Settings → Script Properties** and add all of the following:

| Property | Value |
| --- | --- |
| `PAGESPEED_API_KEY` | Restricted PageSpeed Insights API key |
| `SLIDES_TEMPLATE_ID` | ID of the production copy of the exact three-slide native Slides template |
| `GENERATED_SLIDES_FOLDER_ID` | ID of `Generated Slides` |
| `GENERATED_PDFS_FOLDER_ID` | ID of `Generated PDFs` |
| `REPORT_PREVIEWS_FOLDER_ID` | ID of `Report Previews` |
| `AUDIT_LIBRARY_SPREADSHEET_ID` | ID of the standalone `Lumen Audit Library` spreadsheet |
| `LUMEN_BACKEND_SECRET` | A unique random value of at least 32 characters; the same value is added to Vercel |
| `MAX_PAGES_PER_SCAN` | `5` |
| `MAX_CONCURRENT_SCANS` | `3` |
| `RATE_LIMIT_SCANS_PER_HOUR` | `5` |
| `PAGESPEED_DAILY_REQUEST_LIMIT` | `1000`, or a lower number aligned to the project's quota |
| `REPORT_RETENTION_HOURS` | `24` |

No tracker spreadsheet ID, outreach sheet, Gmail permission, email template, organization row, Gemini key, or LLM key is required.

### 8. Authorize and deploy the Apps Script web app

1. In the Apps Script editor, select `installLumenCleanupTrigger` and choose **Run** once. Approve the requested Drive, Slides, read-only Sheets, external-request, and trigger-management permissions.
2. Confirm the execution log says the cleanup was installed with a 24-hour retention period. The trigger now runs hourly, so generated files are normally moved to Trash between 24 and 25 hours after creation.
3. Select **Deploy → New deployment**.
4. Choose **Web app**.
5. Set **Execute as** to **Me** (the production Lumen account).
6. Set **Who has access** to **Anyone**. The endpoint still requires the server-only `LUMEN_BACKEND_SECRET` on every request.
7. Deploy, copy the URL ending in `/exec`, and keep the deployment ID private.
8. For later code changes, use **Deploy → Manage deployments → Edit → New version** so the production `/exec` URL remains stable.

Cleanup moves files to Google Drive Trash rather than permanently deleting them immediately. This keeps accidental deletion recoverable; Google normally removes trashed files permanently after its Trash retention period. If you need the storage space reclaimed immediately, empty the production account's Trash manually.

### 9. Connect the frontend to the backend

The browser sends requests only to the same-origin `/api/lumen` proxy. That server function hashes the caller's network address for rate limiting, adds the secret, and forwards the request to Apps Script. The Apps Script URL, secret, PageSpeed key, and Google file IDs are never included in browser code.

Set these Vercel environment variables for Production, Preview, and Development as appropriate:

| Variable | Scope | Value |
| --- | --- | --- |
| `VITE_LUMEN_API_URL` | Browser-safe | `/api/lumen` |
| `LUMEN_APPS_SCRIPT_URL` | Server only | The Apps Script deployment URL ending in `/exec` |
| `LUMEN_BACKEND_SECRET` | Server only | Exactly the same random value as the Script Property |

The committed `.env.example` contains every frontend/server environment variable. Do not prefix either secret server value with `VITE_`.

### 10. Deploy the frontend and connect `lumen.oneweb.social`

1. Import this repository into Vercel and set the **Root Directory** to `lumen`.
2. Vercel will use the included Vite settings, build command, output directory, and server function.
3. Add the three environment variables above and deploy.
4. In the Vercel project, open **Settings → Domains** and add `lumen.oneweb.social`.
5. At the DNS provider for `oneweb.social`, add the exact CNAME or A record Vercel displays. If DNS is managed by Vercel, use the offered automatic configuration.
6. Wait until Vercel shows the domain as valid and its TLS certificate as active.
7. Keep the production canonical URL as `https://lumen.oneweb.social`.

### 11. Test the complete production flow

1. Open `https://lumen.oneweb.social` in a private browser window.
2. Confirm the landing screen contains only the Lumen brand and integrated URL control.
3. Submit a small public site you control.
4. Confirm the progress screen names the submitted domain and advances through the five real backend stages.
5. In the Apps Script execution log, confirm one public execution completes and no Gmail or outreach authorization appears.
6. In Drive, confirm one copied three-slide presentation, one PDF, and three PNG page previews were created in the correct folders.
7. Confirm the result screen shows those three actual PNG report pages and that **Download PDF** opens the matching generated PDF.
8. Repeat on a phone-sized viewport and verify the report pages swipe horizontally.
9. Try `localhost`, `127.0.0.1`, a private IP, a non-HTTP scheme, and a URL that redirects to a private address; each must be rejected.
10. Submit more than the configured hourly limit from the same connection and confirm Lumen returns the rate-limit message.
11. Test with one site that has fewer than five usable pages and one with at least five representative pages.
12. After a report is older than 24 hours, run `cleanupExpiredLumenReports_` manually once or wait for the hourly trigger. Confirm its generated Slides copy, PDF, and three PNG previews moved to Trash while the source template remains in place.

For launch, also confirm the production Google account's Drive storage, Apps Script execution quotas, PageSpeed quota alerts, and Vercel function-duration limits are appropriate for expected traffic.
