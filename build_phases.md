# BIS Photo Uploader Build Phases

Oct 9, 2026 · @Mitesh Soni

Nine phases take the app from a portal check to a tested install on client PCs, about 220 to 315 hours in total (my rough estimate). Each phase ends with a test that must pass before the next one starts.

## Phases at a glance

1. **Phase 0, Portal discovery and foundation** (15 to 25 h): learn what the portal really does, set up the project and a mock portal.
2. **Phase 1, Portal driver** (35 to 50 h): login, scan rows, upload one photo, verify it.
3. **Phase 2, Photo pipeline and queue** (30 to 40 h): resize photos, saved queue, retries, pause and resume.
4. **Phase 3, Phone link** (30 to 40 h): QR pairing and the guided phone page.
5. **Phase 4, Desktop screens** (35 to 45 h): the screens staff see on the PC, plus settings.
6. **Phase 5, Reports and history** (15 to 20 h): result report, batch history, logs.
7. **Phase 6, Hardening and security** (20 to 30 h): lock it down and break it on purpose.
8. **Phase 7, Packaging and remote install** (15 to 25 h): one portable app you can install over remote access.
9. **Phase 8, Pilot and stabilise** (25 to 40 h): real portal at one centre, fix what appears, then roll out.

Phases 0 to 6 are built and tested here against a mock portal. Phase 3 also needs real phones, and Phases 0, 7 and 8 need a real Windows PC and the real BIS portal, which I cannot reach from here.

## Phase 0: Portal discovery and foundation

Goal: replace guesses about the portal with facts, and have a project that runs and tests itself.

**Build**

- Project skeleton: Electron, React with plain JavaScript (Vite), Node main process, folder layout, lint and test tools.
- One settings file for everything the portal decides: page addresses, element names, dropdown values (800 x 600, 50 KB), limits, delays.
- A mock portal that copies the pages from your videos: login page, HUID List with several pages, upload page with popup, image page.
- A written note of the real portal facts: how the Upload Image link works (address or click), how the HUID photo is chosen, what success looks like, how long a login lasts.

**Test**

- The project starts, tests run, and the mock portal opens in Chrome.

**Done when**

- Every open question in the portal note has an answer or a clear owner, and the settings file lists every element name the driver will need.

## Phase 1: Portal driver

Goal: a program that can log in with the user's help, read the rows and upload one photo to the right row. All portal knowledge lives in this one module.

**Build**

- Open the PC's installed Chrome with Playwright and a saved profile, so the login survives restarts.
- Detect "logged in" and "logged out" reliably, including a redirect to the login page in the middle of work.
- Scan the HUID List across every page and save each row: tag, category, purity, HUID, upload link.
- Upload one photo to one row: open the link, check that job, tag and HUID match the row, set the dropdowns, attach the file, click Upload Photos, accept the popup.
- Verify the result on the image page, and return a clear outcome: uploaded, rejected with a reason, or uncertain.
- Handle CAPTCHA and expired logins by pausing and asking the user, never by guessing.

**Test**

- Against the mock portal: multi-page scan, article and HUID upload, wrong-row guard, popup missing, slow page, logout in the middle, duplicate upload.

**Done when**

- All mock tests pass, and the driver exposes one function, uploadImage(row, type, file), that the rest of the app calls.

## Phase 2: Photo pipeline and queue

Goal: every photo that arrives is made portal-ready and uploaded in order, and nothing is lost if the PC restarts.

**Build**

- Photo preparation with sharp: fix phone rotation, resize to 800 x 600, compress under 50 KB, remove location data. The original is never changed.
- File checks: real image type, size limit, and a fingerprint to catch the same photo sent twice.
- A saved queue in a JSON file, written safely (write to a temporary file, then rename) with a backup copy.
- One upload at a time by default, with a short pause between uploads. The speed is a setting.
- Retries with growing waits for network and server errors. No retry for a clear rejection of a bad file.
- States for every slot: waiting, uploading, uploaded, failed, uncertain, skipped.
- Pause, resume, cancel, and "sign in again" pauses that do not count as failures.
- Crash recovery: on start, offer to resume the unfinished batch. An "uncertain" slot is checked on the portal's image page before it is retried.

**Test**

- Photos that are too large, rotated, damaged, or duplicated; kill the app in the middle of an upload and restart; cut the network; 200 queued photos.

**Done when**

- No photo is uploaded twice or silently dropped in any test, and the queue file survives a forced shutdown.

## Phase 3: Phone link

Goal: staff take photos on a phone and send them to the PC over Wi-Fi, in a guided flow, and the PC never accepts photos from itself.

**Build**

- A small local server (Express) inside the app, reachable only on the local network.
- A QR code with a one-time pairing code that expires. The phone stays paired for the day. The PC lists connected phones and can disconnect one.
- Rejection of any upload that comes from the PC's own address.
- The phone page, plain HTML and JavaScript with no install: guided "next photo" mode (Row 3 of 12, Article photo, then HUID photo, then next row), the phone's own photo button, preview and retake, Send, and a live status per row.
- Limits on photo size and number, and checks that the row and photo type are valid before the PC accepts them.
- Firewall setup: the app asks Windows to allow it once, and the install notes say how to fix it by hand.
- A fallback address shown in text for when the QR code cannot be scanned.

**Test**

- Real phones (Android and iPhone browsers) against the PC app on the same Wi-Fi, on a phone hotspot, with Wi-Fi dropping, with an old or wrong pairing code, and with a photo sent from the PC itself.

**Done when**

- A full job goes from phone to mock portal without touching the PC, and every refused case shows a clear message on the phone.

## Phase 4: Desktop screens and settings

Goal: a PC screen the owner can run all day without reading instructions.

**Build**

- Home screen: one Connect button, login status, the QR code, connected phones, and a clear "what to do next" line.
- Job screen: the scanned rows with Article and HUID slots, each showing its photo thumbnail and state in colour (waiting, uploading, done, failed, missing).
- Queue controls: pause, resume, retry failed, skip a slot, replace a photo.
- A checklist at the end of a job listing every row that still has no photo.
- Plain messages for every error, such as "Login ki zaroorat hai", with the fix next to it. Messages live in one file so a Hindi and English switch can be added later.
- Settings: upload speed, image limits, portal element names (advanced, behind a password prompt), photo folder, and a Sign out button that clears the saved login.
- Activity log screen for support, with no passwords or tokens in it.
- Electron safety: the React screens have no direct access to files or Node, only a small list of allowed actions.

**Test**

- Walk through a full job on the mock portal with screenshots at each step; check small and large Windows screen sizes and 125% and 150% display scaling.

**Done when**

- A person who has never seen the app completes a mock job from the on-screen hints alone.

## Phase 5: Reports, history and logs

Goal: the centre can prove what was uploaded and find any problem later.

**Build**

- Per-job result report to Excel and CSV: job, tag, HUID, photo type, result, time, reason, and any reference the portal returns.
- Batch history: a list of past jobs with counts, and the ability to reopen one and retry its failed slots.
- Log files with daily rotation, kept for a set number of days. They never contain passwords, cookies or tokens.
- A "copy support info" button that bundles the log, app version and settings, with private data removed.
- Photo cleanup: delete stored photos after a chosen number of days, so the PC does not fill up.

**Test**

- Open exported files in Excel; run a job with mixed results and check every row against the portal image page; check that a search of the logs finds no secrets.

**Done when**

- The report matches the mock portal's records exactly for a 100-photo run.

## Phase 6: Hardening, security and failure testing

Goal: the app stays safe and calm when things go wrong, because on a client PC something always does.

**Build**

- Network safety: the phone server listens only on the local network, checks the pairing code on every request, limits request size and rate, and shuts off when no job is running.
- Electron safety review: no direct Node access from screens, only BIS addresses allowed in the login window, links to other sites open in the normal browser.
- Input safety: file names, row ids and photo types are checked before use; photos are verified as real images; no file paths from the phone are ever trusted.
- A stop rule: if many uploads in a row fail the same way, the queue stops and tells the user to update the app, so a portal change cannot cause hundreds of bad attempts.
- Settings and queue file checks on start, with a safe default or a restored backup if a file is damaged.

**Test**

- Failure injection against the mock portal: login expiry, CAPTCHA, offline, very slow page, missing popup, changed element name, damaged queue file, full disk, two phones at once.
- A long run of 500 uploads while watching memory use and open Chrome windows.
- A written checklist of security checks, each marked pass or fail.

**Done when**

- Every injected failure ends in a clear message and a recoverable state, and the long run finishes without growing memory or leftover processes.

## Phase 7: Packaging and remote install

Goal: you can install, update and fix the app on any client PC over remote access in minutes, with no certificate.

**Build**

- A Windows build with electron-builder: one portable app folder or .exe, with a version number shown inside the app.
- A setup checklist and script: copy the app, add the firewall rule for the phone link, create a desktop shortcut, check that Chrome is installed.
- A simple update path: the app can check for a newer version and tell the user, and you replace the folder remotely. Settings and the queue are kept in a separate data folder, so an update never erases them.
- A "backup settings" and "restore settings" button.
- An uninstall note that removes the app and, if the client wants, the saved data.
- A one-page user guide in Hinglish with screenshots, and a one-page support guide for you.

**Test**

- Install from scratch on a clean Windows PC, update from one version to the next while a batch is paused, uninstall, and check what antivirus says about the unsigned app.

**Done when**

- A clean PC goes from nothing to a working app in under 30 minutes by following the checklist alone.

## Phase 8: Pilot and stabilise

Goal: prove it on the real portal at one centre, then fix issues one at a time until it is dependable. This is where "perfect" gets earned.

**Run in three steps**

1. A job with 2 or 3 rows, watched live. Fix the element names in the settings file and anything the real portal does differently.
2. A full real job, with a person comparing the app's report to the portal's image pages.
3. A normal working week at one centre, with you on call and every problem written in an issue list with its fix and date.

**Build**

- Fixes from the issue list, each with a new test added so it cannot return.
- Tuning of upload speed, waits and retry counts from real timings.
- Staff training of about 30 minutes using the user guide.
- A rollout checklist for each new centre, and a short routine for what to do when BIS changes the portal.

**Done when (targets I propose)**

- Two weeks at the pilot centre with no lost or wrong-row uploads, every failed upload explained by a clear message, and staff finishing a job without calling you.

## Before we start

Phase 0 moves fastest if you do these in parallel. None of them blocks me from starting the project skeleton.

- [ ] Save the HUID List page and the upload page from the real portal (browser Save As, complete page) with personal data removed, or send screenshots of each, including the dropdown choices opened.
- [ ] Do one manual article upload and one HUID upload with DevTools open (Network tab) and send the request details with cookies and tokens removed.
- [ ] Tell me what happens after Upload Photos: the popup text and the page you land on.
- [ ] Email the BIS helpdesk to ask whether an official bulk upload exists and whether automated upload is allowed.
- [ ] Confirm the Windows version on client PCs, and that Chrome is installed on them.
- [ ] Name the pilot centre and a date when a real job can be tried.

## Ground rules and risks

**Rules for every phase**

- A phase is finished only when its "Done when" test passes, and the next phase does not start before that.
- The portal's names and values stay in the settings file, and portal code stays in the one driver module.
- No password, cookie or token is ever stored, logged or sent anywhere.
- Every bug found later gets a test, so the same bug cannot return.
- Each phase ends with a short note of what works, what is known to be missing, and what the next phase needs.

**Main risks**

- **BIS does not allow automated upload.** This could end the project. Ask BIS in Phase 0, before spending on the later phases.
- **The portal changes.** Uploads then fail until the settings or the driver are updated. The stop rule limits the damage, and Phase 8 sets up a routine for it.
- **Real phones and Wi-Fi behave differently from the lab.** Phone tests in Phase 3 need real devices, so I will ask you to run them.
- **Antivirus flags the unsigned app.** Test early on a client PC and keep a list of exclusions to add during remote setup.
- **The estimate moves.** The hours are my rough estimate, and Phase 0's findings can raise or lower them.
