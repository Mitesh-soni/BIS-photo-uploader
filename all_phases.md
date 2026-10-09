# BIS Photo Uploader Build Phases

Oct 9, 2026 · @Mitesh Soni

Ten phases take the app from a portal check to a tested install on client PCs, about 240 to 340 hours in total (my rough estimate). Each phase ends with a test that must pass before the next one starts. Everything runs on the centre's PC, and the only outside services are the BIS portal and your billing API.

## How one job runs

This is the flow of the existing tool from your videos, rebuilt so that nothing needs a terminal or a hosted server. A job is one job card, and the app handles one job at a time.

1. **Connect.** The user clicks Connect. Chrome opens the BIS portal and the user logs in (ID, password, CAPTCHA).
2. **Open the job.** In that Chrome window the user opens the photo upload page (the list of jobs) and opens one job's HUID List. The app notices which job card is open.
3. **Scan.** The user clicks Scan. The app reads every row of that job across all pages and shows "N tags found". The user confirms.
4. **Start phone link.** The app checks this PC's key with your billing API, starts its own small server inside the app, and shows a QR code.
5. **Phone.** The phone scans the QR and opens a table page with serial number, HUID, article image and status, HUID image and status. The user takes the Article and HUID photos and sends each one to the PC.
6. **Upload.** As each photo arrives, the app prepares it and Chrome uploads it to BIS. Both screens show the status of every row, and a Pause button stops the queue.
7. **Finish job.** When all rows are done, the user clicks Finish job. The app stops uploading and the server, removes the QR and saves the report.
8. **Next job.** The user opens the next job in Chrome and clicks Scan, and the same steps repeat.

The existing tool has separate buttons to start and stop Article and HUID monitoring and to start and stop the server. Here, uploading starts as photos arrive and Finish job stops everything, so those buttons are not needed.

## Phases at a glance

1. **Phase 0, Portal discovery and foundation** (15 to 25 h): learn what the portal really does, set up the project and a mock portal.
2. **Phase 1, Portal driver** (35 to 50 h): login, detect the open job, scan all tags, upload one photo, verify it.
3. **Phase 2, Job sessions and queue** (30 to 40 h): one saved session per job, photo preparation, retries, pause and resume.
4. **Phase 3, Phone link** (30 to 40 h): the server inside the app, QR pairing and the table page on the phone.
5. **Phase 4, Desktop screens** (35 to 45 h): the step-by-step screens staff use on the PC, plus settings.
6. **Phase 5, Reports and history** (15 to 20 h): result report per job, job history, logs.
7. **Phase 6, Hardening and security** (20 to 30 h): lock it down and break it on purpose.
8. **Phase 7, One key per PC** (18 to 28 h): each PC has its own key, tied to that PC and checked through your billing system.
9. **Phase 8, Packaging and per-PC setup** (15 to 25 h): one portable app and a setup routine for every new PC.
10. **Phase 9, Pilot and stabilise** (25 to 40 h): real portal at one centre, fix what appears, then roll out.

Phases 0 to 7 are built and tested here against a mock portal and a stub billing API. Phase 3 also needs real phones, and Phases 0, 8 and 9 need a real Windows PC and the real BIS portal, which I cannot reach from here.

## Phase 0: Portal discovery and foundation

Goal: replace guesses about the portal with facts, and have a project that runs and tests itself.

**Build**

- Project skeleton: Electron, React with plain JavaScript (Vite), a Node main process, folder layout, lint and test tools.
- One settings file for everything the portal decides: page addresses, element names, dropdown values (800 x 600, 50 KB), limits and delays.
- A mock portal that copies the pages from your videos: login page, the photo upload page with a list of several jobs, a HUID List per job with several pages, the upload page with its popup, and the image page.
- A written note of the real portal facts: how the job list opens a job, how the Upload Image link works (address or click), how the HUID photo is chosen, what success looks like, and how long a login lasts.

**Test**

- The project starts, the tests run, and the mock portal opens in Chrome.

**Done when**

- Every open question in the portal note has an answer or a named owner, and the settings file lists every element name the driver will need.

## Phase 1: Portal driver

Goal: a program that can open Chrome for the user to log in, see which job is open, read every tag of that job and upload one photo to the right row. All portal knowledge lives in this one module.

**Build**

- Open the PC's installed Chrome with Playwright and a saved profile, so the login survives restarts.
- Detect "logged in" and "logged out" reliably, including a redirect to the login page in the middle of work.
- Detect the job that is open in Chrome: job card number, material category and job card date, read from the HUID List page. If no HUID List is open, the Scan button says so.
- Fresh scan of all tags: read every page of the HUID List and save each row (S.No, AHC tag, material category, item category, declared purity, HUID, upload link). Return the tag count for the "N tags found" message.
- Upload one photo to one row: open the link, check that job, tag and HUID match the row, set the dropdowns, attach the file, click Upload Photos, accept the popup.
- Verify the result on the image page, and return a clear outcome: uploaded, rejected with a reason, or uncertain.
- Pause and ask the user for a CAPTCHA or an expired login, never guess.

**Test**

- Against the mock portal: several jobs, multi-page lists, scanning the same job twice, switching jobs between scans, article and HUID upload, the wrong-row guard, a missing popup, a slow page, a logout in the middle and a duplicate upload.

**Done when**

- All mock tests pass, and the driver offers two calls to the rest of the app: scanJob() and uploadImage(row, type, file).

## Phase 2: Job sessions and queue

Goal: every job is a saved session, every photo that arrives is made portal-ready and uploaded in order, and nothing is lost if the PC restarts.

**Build**

- A job session per job card, saved in a JSON file written safely (a temporary file, then a rename) with a backup copy. Its states: scanned, phone link on, uploading, paused, finished.
- Scanning a job that already has a session keeps the rows already uploaded and only adds or updates the rest, so a fresh scan never makes the app upload a photo twice.
- Photo preparation with sharp: fix phone rotation, resize to 800 x 600, compress under 50 KB, remove location data. The original is never changed.
- File checks: real image type, size limit, and a fingerprint to catch the same photo sent twice.
- Two slots per row, Article and HUID, each with its own state: empty, waiting, uploading, uploaded, failed, uncertain, skipped.
- Uploading starts as each photo arrives. One upload at a time by default, with a short pause between uploads, and the speed is a setting.
- Retries with growing waits for network and server errors, and none for a clear rejection of a bad photo.
- Pause, resume, and "sign in again" pauses that do not count as failures.
- Finish job: allowed when every slot is uploaded or skipped, or after the user confirms the leftovers. It closes the session.
- Crash recovery: on start, offer to resume the unfinished session. An "uncertain" slot is checked on the portal's image page before it is retried.

**Test**

- Photos that are too large, rotated, damaged or duplicated; killing the app in the middle of an upload and restarting; cutting the network; a rescan in the middle of a job; 200 queued photos.

**Done when**

- No photo is uploaded twice or silently dropped in any test, and the session file survives a forced shutdown.

## Phase 3: Phone link

Goal: staff take photos on a phone and send them to the PC over the centre's Wi-Fi, using a small server that lives inside the app, and the PC never accepts photos from itself.

**Build**

- A small local server (Express) inside the app. It starts when the user clicks Start phone link and stops on Finish job, so there is no terminal and no command to run. It is reachable only on the local network.
- A QR code with the PC's local address and a one-time pairing code that expires. The PC lists connected phones and can disconnect one. The address is also shown as text for when the QR cannot be scanned.
- Rejection of any upload that comes from the PC's own address.
- The phone page, plain HTML and JavaScript with nothing to install. It shows the job's table: serial number, HUID, article image and status, HUID image and status. A "next photo" mode on top walks the user through the rows one by one, using the phone's own photo button with a preview and retake before Send.
- Live status per row on the phone, which polls the PC every few seconds. A failed photo can be retaken on the spot.
- Checks before the PC accepts a photo: the session is active, the row and photo type exist, the size and number are within limits.
- Firewall: the app asks Windows to allow it once, and the setup notes say how to fix it by hand.

**Test**

- Real phones (Android and iPhone browsers) against the PC app on the same Wi-Fi, on a phone hotspot, with Wi-Fi dropping, with an old or wrong pairing code, with a photo sent from the PC itself, and with two phones at once.

**Done when**

- A full job goes from phone to the mock portal without touching the PC, the server stops when the job finishes, and every refused case shows a clear message on the phone.

## Phase 4: Desktop screens that follow the six steps

Goal: a PC screen that staff who know the existing tool can use on day one, and anyone else can follow from the hints.

**Build**

- A home screen with the steps in order, each a big button that stays grey until the step before it is done: 1 Connect, 2 Scan, 3 Start phone link, 4 Upload status, 5 Finish job. Each button shows a short line saying what happened or what to do next.
- After Scan, a message "N tags found" with an OK button, as in the existing tool.
- The QR code and the list of connected phones appear after Start phone link.
- The job table: one row per tag with Article and HUID slots, each showing its thumbnail and a colour for its state (empty, waiting, uploading, done, failed).
- Queue controls: pause, resume, retry failed, skip a slot, replace a photo.
- A checklist at Finish job listing every row that still has no photo.
- Plain messages for every error, such as "Login ki zaroorat hai", with the fix next to it. The messages live in one file so a Hindi and English switch can be added later.
- Settings: upload speed, image limits, portal element names (advanced, behind a password prompt), photo folder, and Sign out, which clears the saved BIS login.
- Activity log screen for support, with no passwords or tokens in it.
- Electron safety: the React screens have no direct access to files or Node, only a short list of allowed actions.

**Test**

- Walk through two full jobs in a row on the mock portal with a screenshot at each step; check small and large Windows screens and 125% and 150% display scaling.

**Done when**

- A person who has never seen the app completes a mock job from the on-screen hints alone, and then starts the next job without help.

## Phase 5: Reports, history and logs

Goal: the centre can prove what was uploaded for each job and find any problem later.

**Build**

- A report per job, saved at Finish job and exportable to Excel and CSV: job card number, tag, HUID, photo type, result, time, reason, and any reference the portal returns.
- Job history: a list of past jobs with counts. Reopening one shows its rows and lets the user retry its failed slots, if the portal job is still open.
- Log files with daily rotation, kept for a set number of days. They never contain passwords, cookies, tokens or the licence key.
- A "copy support info" button that bundles the log, app version, PC id and settings with private data removed.
- Photo cleanup: delete stored photos after a chosen number of days, so the PC does not fill up.

**Test**

- Open exported files in Excel; run a job with mixed results and check every row against the portal's image pages; search the logs for secrets and find none.

**Done when**

- The report matches the mock portal's records exactly for a 100-photo job.

## Phase 6: Hardening, security and failure testing

Goal: the app stays safe and calm when things go wrong, because on a client PC something always does.

**Build**

- Network safety: the phone server listens only on the local network, checks the pairing code on every request, limits request size and rate, and runs only while a job is active.
- Electron safety review: no direct Node access from screens, only BIS addresses allowed in the login window, links to other sites open in the normal browser.
- Input safety: file names, row ids and photo types are checked before use, photos are verified as real images, and no file path from the phone is ever trusted.
- A stop rule: if many uploads in a row fail the same way, the queue stops and tells the user to update the app, so a portal change cannot cause hundreds of bad attempts.
- Start-up checks on the settings and session files, with a safe default or a restored backup if a file is damaged.

**Test**

- Failure injection against the mock portal: login expiry, CAPTCHA, offline, a very slow page, a missing popup, a changed element name, a damaged session file, a full disk, and two phones at once.
- A long run of 500 uploads across several jobs while watching memory use and open Chrome windows.
- A written checklist of security checks, each marked pass or fail.

**Done when**

- Every injected failure ends in a clear message and a recoverable state, and the long run finishes with no memory growth and no leftover processes.

## Phase 7: One key per PC

Goal: every PC has its own key, entered at setup and tied to that PC, and the phone link works only while that key is active in your billing system.

**How a PC gets its key**

1. At setup, the app shows this PC's id, a code made from the PC itself.
2. You create a key for that PC in your billing system, with the centre name and the PC id.
3. You enter the key in the app on that PC. The app checks it with your billing API, which links the key to the PC id the first time.
4. From then on the key works only on that PC. The same key arriving from another PC id is refused. To move to a new PC, you reset the link in your billing system and set up the new PC with its own key.

A key per PC is more secure than a key per centre. A leaked or copied key does not work anywhere else, you can switch off one PC without touching the centre's other PCs, and you can see which PC uses which key.

**How the key is checked** The desktop app makes the check, and the phone never sees the key or the API. Photos can only come from the phone, so blocking the phone link blocks the whole upload flow.

- At Start phone link: no active key, no QR, and the screen says "Licence inactive, contact admin".
- When the phone opens the page: the PC checks again, reusing a reply that is under a minute old.
- While the phone page is open: the PC re-checks every few minutes (my proposal: 5).
- Before every upload: the PC uses a check no older than those few minutes.
- If the key turns inactive: the phone page shows the blocked message, new photos are refused, and the queue finishes the upload in progress and pauses. Reports and history still work, and nothing is deleted. A renewed key resumes the queue.
- If your billing API cannot be reached: the app keeps working on the last "active" reply for a grace time (my proposal: 24 hours), then blocks. The grace time is a setting, and 0 means block at once.

**Build**

- The PC id, taken from the operating system and hashed, shown on the licence screen. It stays the same across restarts and app updates.
- The key stored with the operating system's protection, and never written to logs or reports.
- One licence guard in the main process that scan, queue start, upload, phone link and photo receive all pass through. Hiding buttons is not enough.
- Billing API client: HTTPS only, timeouts, one retry, the latest result cached, clear errors. The reply fields it reads are in the settings file, so a change in the API means editing a setting.
- Licence screen: PC id, the key with only its last 4 characters shown, status, expiry date if the API gives one, last check time, a warning when expiry is near, and a Change key button. A new key must pass the check before it replaces the old one.
- Blocked states on the phone page and on the PC, with plain messages.
- Optional: signed replies from your billing system, so a faked reply can be detected.

**Test**

- Against a stub billing API that I build: active, expired, suspended, unknown key, key linked to another PC, slow reply, timeout, server error and a reply in the wrong format.
- Switch the key off while the phone page is open and a batch is running; leave the API unreachable for longer than the grace time; copy the app and its data folder to a second PC, which must fail; change the PC id and check that the key is refused until you reset the link; enter a new key.

**Done when**

- Turning a key off blocks the phone page within the re-check time and pauses the queue, turning it on resumes both without losing the queue, and a key used on a second PC is refused.

**Limits and needs**

- The check is only as strong as its reply. HTTPS stops most tampering and signed replies stop more, but a determined developer could still patch the app.
- Never put a billing admin secret in the app, because anyone can extract it from the installed files. The check must work with the key and the PC id alone, through an endpoint that returns only active or not (and the expiry date).
- A Windows reinstall or a major hardware change can change the PC id, so keep the reset step in your billing system ready.
- Needed from you: the API address and method, what the request must contain, what the reply looks like for an active, expired and unknown key and for a key on another PC, whether your billing system can store a PC id per key, whether it needs a login or token, and how many requests per minute it allows.
## Phase 8: Packaging and per-PC setup

**Goal:** turn the tested application into a Windows app that a centre can install and activate on each PC without opening a terminal, manually installing Node.js/Python, or editing configuration files.

**Build**

- **Choose one supported release target first:** Windows 10/11, 64-bit. Record the minimum supported Windows version and test on a clean PC before distributing it.
- **Package the Electron app:** use `electron-builder` to create a signed Windows installer (for example, NSIS). The installer includes the React UI, Node runtime, application code, and required production dependencies. A user must not need a separate Node.js or Python installation.
- **Build native dependencies for Electron:** rebuild and test native modules such as `better-sqlite3` and `sharp` for the exact Electron version and Windows architecture. Do not assume a development build will work after packaging.
- **Handle Playwright/Chrome explicitly:** detect the supported installed Chrome version and show a clear setup message if it is missing or unsupported. Do not silently download a browser on a client PC. Confirm the chosen Playwright connection method works with the saved browser profile and that the installer does not create duplicate Chrome profiles.
- **Create a first-run setup wizard:** show the PC ID, request the per-PC licence key, validate it through the billing API, and display a clear active/expired/blocked result. Keep the key in Windows-protected storage, never in the install folder, JSON session files, logs, or reports.
- **Keep user data outside the install directory:** store the database, job sessions, prepared photos, reports, logs, and settings under the Windows per-user application-data directory. An app update must not overwrite them.
- **Configure the phone link safely:** start the local server only when a job is active and the user starts the phone link. Explain that the phone and PC must be on the same local network. Request or document the Windows Firewall permission needed for local-network access; do not open a broad public-network rule. If the firewall blocks access, show a troubleshooting message and a manual fix.
- **Add shortcuts and normal Windows lifecycle behavior:** create Start Menu/Desktop shortcuts, show app version and support information, close background workers and the local server on exit, and avoid leaving Chrome or server processes running after the app closes.
- **Define upgrade and uninstall behavior:** upgrades preserve licence state, unfinished sessions, reports, and history. Uninstall should offer a clearly explained choice to keep or remove user data; it must not silently delete business records.
- **Sign release artifacts when a code-signing certificate is available:** verify the publisher and signature on the installer and executable. If signing is not available for the pilot, document the Windows warning and the trusted distribution process rather than instructing users to ignore arbitrary warnings.
- **Produce a per-PC setup guide:** include install, first activation, Chrome/BIS login, local-network and firewall checks, upgrade, backup/restore, support bundle, and licence transfer/reset instructions.
- **Create a release manifest:** record app version, build date, supported Windows version, installer checksum, signing status, and any required billing API version. Do not put secrets in the manifest.

**Test**

- Install on a clean Windows 10/11 64-bit PC that has no Node.js or Python installed; the app must launch without a terminal.
- Complete first-run activation with an active key, then test expired, suspended, unknown, wrong-PC, and billing-API-unavailable cases using the stub API or approved test environment.
- Confirm the app shows the same PC ID after restarts and app upgrades. Confirm copying the installation and data folder to a second PC does not make the licence valid there.
- Open Chrome, sign in to the mock portal, scan a multi-page job, pair a phone, send Article and HUID photos, finish the job, and export the report from the packaged build.
- Test phone access on the centre's Wi-Fi and a phone hotspot; test firewall denied, wrong/expired QR pairing code, and server shutdown after Finish job and app exit.
- Upgrade from the previous build with an unfinished job. Verify job sessions, licence state, settings, history, and reports remain intact and the queue does not duplicate completed uploads.
- Uninstall and reinstall. Verify the chosen keep/remove-data behavior, and confirm there are no orphaned local-server processes or unexpected Chrome instances.
- Verify native modules load, image preparation works, report export works, and no development server, source map, test secret, stub billing endpoint, or mock-portal setting is accidentally enabled in the release.
- Verify the installer checksum and code signature when signing is enabled, and test the setup guide with someone who did not build the app.

**Done when**

- A new centre can install and activate the app on a clean supported Windows PC using the written guide, without a developer or terminal.
- The packaged app completes one full job against the mock portal and a real phone, preserves state across an upgrade, and refuses a key linked to another PC.
- The installer, version, checksum, signing status, and release notes are recorded; user data survives upgrades and is only deleted through an explicit uninstall choice.
- No real BIS rollout is declared ready solely because packaging passes. Real-portal compatibility and a centre pilot remain Phase 9.

**Decisions / inputs needed before release**

- Confirm the supported Windows versions and whether centres require a per-user install or an all-users install.
- Provide the billing API's production URL, authentication requirements, response schema, rate limits, and a test key/API environment. The desktop app must never contain a billing-admin secret.
- Decide whether a code-signing certificate will be available for the pilot and production releases.
- Decide whether updates are manual or automatic. If automatic updates are enabled, use a trusted signed release channel and preserve the same per-PC licensing and data-protection rules.
- Confirm the Chrome installation policy at client centres and whether IT staff can approve the local-network firewall rule.
- Set the backup and data-retention policy for job records, reports, and stored photos before rollout.


## Phase 9: Pilot and stabilise

**Goal:** prove the packaged app works reliably in the real workflow at one hallmarking centre before rolling it out more widely.

**Build**

- Choose one pilot centre and one supported Windows PC. Record the Windows version, Chrome version, network setup, screen scaling, and any local security restrictions.
- Run a supervised end-to-end job: the user signs in to BIS manually, opens a job, scans all HUID pages, pairs a phone, captures Article and HUID photos, uploads them, verifies the portal results, and exports the report.
- Start with a small job and increase the volume only after the smaller job passes. Record expected and actual counts for scanned rows, received photos, successful uploads, rejected uploads, skipped slots, and uncertain results.
- Keep a pilot checklist and issue log. For every issue, record the steps to reproduce it, app version, relevant redacted logs, impact, fix, and regression test.
- Verify that the app handles expired login, CAPTCHA, portal delays, connection loss, PC restart, phone disconnection, duplicate photo submissions, and a failed or uncertain upload without silently losing work or uploading to the wrong HUID.
- Confirm that staff understand the workflow and can identify missing photos, retry failed slots, finish a job, find the report, and contact support.
- Do not bypass CAPTCHA, access controls, or portal restrictions. Pause for the user when manual action is required, and confirm that the intended real-portal workflow is permitted before broad commercial rollout.
- Fix pilot issues in priority order: wrong-row or wrong-HUID risk first, data loss and duplicate uploads second, blocked core workflow third, and usability issues after that.
- Rebuild the installer for each pilot fix, increment the version, record the changes, and repeat the relevant regression tests.
- Back up job records and reports before upgrades. Define who can access pilot logs and how long pilot photos and records are retained.

**Test**

- Complete multiple consecutive jobs, including a job large enough to exercise pagination and a job with deliberately mixed upload outcomes.
- Compare every uploaded Article and HUID image against the intended HUID on the real portal. Verify uncertain outcomes on the portal before retrying them.
- Simulate internet loss, portal logout, application restart, phone Wi-Fi loss, billing API outage, inactive licence, low disk space, and a damaged or incomplete local session.
- Verify that reports match the real portal outcomes and that logs do not contain passwords, cookies, tokens, licence keys, or unnecessary personal information.
- Have a centre staff member who did not build the app complete the workflow using the setup guide and in-app messages.
- Record pilot results, unresolved risks, known limitations, and the decision to proceed, extend the pilot, or stop rollout.

**Done when**

- The pilot centre completes the agreed acceptance workload without wrong-row uploads, silent photo loss, or unexplained duplicate uploads.
- Every failed or uncertain upload is visible, recoverable, and represented accurately in the report.
- Staff can complete the workflow and recover from documented common failures without developer intervention.
- Critical and high-severity issues are resolved or explicitly accepted with a documented mitigation before wider rollout.
- The real-portal workflow has been verified at the pilot centre; mock-portal success alone is not treated as production readiness.

## Phase 10: Production release

**Goal:** publish a controlled, repeatable production release with a known build, clear installation instructions, and a safe recovery path.

**Build**

- Freeze the release scope and identify the exact app version, source revision, build date, supported Windows versions, and required billing API version.
- Run the release checklist against a clean Windows PC using the final packaged installer, not the development environment.
- Confirm production configuration is enabled and mock portal URLs, stub billing endpoints, test keys, debug switches, development servers, and test data are excluded.
- Verify the installer and packaged application files, native dependencies, image processing, report export, Playwright/Chrome integration, local phone server, and licence enforcement.
- Generate and record a checksum for the installer. If code signing is not used, document that the installer is unsigned and provide a trusted distribution and verification process. Do not tell users to ignore arbitrary security warnings.
- Prepare concise release notes describing supported features, fixed issues, known limitations, installation steps, upgrade behavior, and support contact details.
- Prepare a rollback plan: retain the previous known-good installer and explain how to restore a backup of user data if a release must be reverted.
- Publish the installer through the chosen trusted distribution channel and provide it only to the intended customer or authorised recipients.
- Keep a release record containing the installer, checksum, version, test results, release notes, signing status, and rollback instructions.
- Confirm that customer-specific licence keys are issued through the billing system and are not embedded in the installer or shared between PCs.

**Test**

- Install the release on a clean supported Windows PC and follow the customer setup guide from beginning to end.
- Verify activation with the intended production licensing configuration, including invalid or inactive keys and a billing API outage.
- Complete the approved acceptance workflow with a real phone and the portal, then verify image placement and the exported report.
- Upgrade from the previous release and confirm unfinished sessions, settings, reports, and job history remain intact.
- Verify the installer checksum after distribution and verify the signature if signing is enabled.
- Rehearse the rollback and data-restore procedure using a test copy of the data.

**Done when**

- The released installer matches the recorded version and checksum, and the final release checklist has passed.
- A customer can install, activate, and run the supported workflow using the documented instructions.
- Release notes, support details, known limitations, and rollback instructions are available.
- The previous known-good installer and the required backup/restore instructions are retained.

## Phase 11: Post-release support and maintenance

**Goal:** keep the application dependable after delivery as Windows, Chrome, the BIS portal, and the billing service change.

**Build**

- Establish a support process for receiving issue reports, collecting redacted support information, assigning severity, and communicating status to customers.
- Maintain a versioned issue log and a list of supported app, Windows, Chrome, and billing API versions.
- Monitor only the operational information needed for support. Do not collect BIS credentials, browser cookies, licence secrets, or unnecessary customer data.
- Keep a reproducible test environment with a mock portal and stub billing API so fixes can be tested without relying on the live portal for every development cycle.
- When the portal changes, isolate the affected selectors, page structure, upload behavior, or response checks in the portal-driver module and configuration where possible.
- Keep dependencies updated deliberately. Review security advisories and test Electron, Playwright, Sharp, SQLite/native modules, and installer changes before shipping them.
- Maintain a documented release and migration process for app updates, local database/session changes, licence changes, and report compatibility.
- Define a backup and restore policy for local job records, reports, and any photos retained by the app. Test restoration periodically.
- Document how to disable a problematic release, revoke or reset a per-PC licence, and recover a customer's unfinished job.
- Publish maintenance releases with version numbers, release notes, checksums, regression results, and updated installation instructions.

**Test**

- Re-run the critical end-to-end workflow after every portal-driver, dependency, licensing, database, or packaging change.
- Test upgrades from the currently supported release and at least one unfinished job session.
- Verify that support bundles are redacted and contain enough diagnostic information to reproduce common failures.
- Periodically test backup restoration, licence reset/transfer, and rollback to the previous installer.
- Track recurring failures and verify that fixes prevent regressions rather than merely hiding error messages.

**Done when**

- Customers have a clear support route and receive actionable information about known issues and fixes.
- Every production update has a recorded build, checksum, release notes, and test results.
- Backups can be restored, licences can be reset through the billing system, and a bad release can be rolled back.
- Portal or dependency changes are handled through a controlled update process rather than untested edits on customer PCs.
