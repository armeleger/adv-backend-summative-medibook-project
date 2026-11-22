# MediBook — Roadmap to Submission

**Deadline:** Tuesday 24 November 2026, 23:59. Any push after this time is penalized.
**Daily rhythm:** work in focused blocks of about 1–2 hours. At **17:00**, review the day's changes, then approve and push them. Nothing is pushed without a review.
**Commit style:** [Conventional Commits](https://www.conventionalcommits.org/): `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, with an optional scope, e.g. `fix(worker): …`.

This file records only work that has actually been done, and plans the rest. Tick boxes as items land.

---

## Done

### Tue 17 Nov — core build
- [x] 3NF schema, seed data, schema diagram
- [x] Patient/doctor CRUD, booking rules with concurrency control, cancellation + refunds
- [x] SQL statistics and reports, audit log, Redis waitlist + separate worker
- [x] Localized feedback page (EN/FR), 55 unit tests, README

### Wed 18 Nov — rest day
- No development.

### Thu 19 Nov — code review and bug fixes
- [x] Pushed the core history to GitHub (Conventional Commit messages)
- [x] Reviewed the code against the rubric and reproduced 4 genuine bugs (details in [CHANGELOG.md](../CHANGELOG.md)):
  - [x] `fix(doctors)`: availability offered slots in the past
  - [x] `fix(waitlist)`: unknown doctor returned 200 instead of 404
  - [x] `fix(worker)`: a malformed job blocked the processing list forever
  - [x] `fix(worker)`: retries were used up instantly during an outage (now exponential backoff)
- [x] This roadmap and the Miro schema guide
- [x] Reviewed and approved → pushed

### Fri 20 – Sat 21 Nov — no development
- The planned items (leave-waitlist endpoint, API tests) were not started on these days and moved to Sunday.

### Sun 22 Nov — security incident, then catch-up
- [x] Found that both GitHub repos had been force-pushed with forged commits (an `init` start hook, `.env` removed from `.gitignore`). Account secured and both repos restored from the clean local copies.
- [x] `feat(waitlist)`: `DELETE /api/waitlist/:doctorId/:date/:patientId` to leave a waitlist, documented in the README and `requests.http`
- [x] `test(api)`: HTTP-level tests with `supertest`, models and services mocked (90 tests in total, still no MySQL/Redis)
- [x] `ci`: GitHub Actions runs `npm test` on Node 20 and 22
- [x] Approved → pushed
- [ ] Read through `bookingService.js`, `cancellationService.js`, `waitlistService.js` and write your own notes for the video (moved to Monday)

---

## Planned

### Mon 23 Nov — schema in Miro + rehearsal (~3 h)
- [ ] Read through the three service files and write your own video notes (from Sunday)
- [ ] Recreate the schema diagram in Miro using [schema-miro-guide.md](schema-miro-guide.md)
- [ ] Export as PNG (and PDF if you like), replace `schema-diagram.png`, delete `schema-diagram.svg` so only one diagram exists
- [ ] `docs(db)`: commit the Miro export
- [ ] Fresh-clone check: `git clone …`, `npm install`, `npm run db:setup`, `npm start`, `npm run worker`, `npm test`
- [ ] Practice run of the video (see checklist below), timed under 10 minutes
- [ ] 17:00 review → push

### Tue 24 Nov — record and submit (deadline 23:59)
- [ ] Record the video in the morning or early afternoon
- [ ] Final push **before 18:00**, which leaves a comfortable buffer
- [ ] Submit on Canvas: repository link + video link
- [ ] **No pushes after 23:59**

---

## Video checklist (max 10 minutes)

Rubric: show the running app end to end and explain *why*, in your own words.

1. Schema diagram: 3 tables, 1:N relationships, and the `active_flag` unique key (why cancelled slots become rebookable).
2. Booking: a success, a past slot (422), 17:00 (422), a taken slot (409), and the day-full case with the waitlist offer.
3. Concurrency: the doctor row lock plus READ COMMITTED, and why the 12-per-day count cannot race.
4. Cancellation: the refund tiers and both boundaries (exactly 24h and 48h are 50%), and why it is one atomic UPDATE.
5. Waitlist: join, cancel, and the worker terminal promoting the patient. Explain what happens if that booking fails.
6. Reports: doctor stats, doctors report (doctor 4 with zeros), busy days.
7. Audit log lines and `npm test`.
8. Feedback page in English and French.

## Viva questions to be ready for

- Why is `amount_paid` stored on appointments when the fee is on doctors?
- What would go wrong without `SELECT … FOR UPDATE` on the doctor row?
- Why READ COMMITTED instead of the default REPEATABLE READ?
- Why is a refund boundary of exactly 48h worth 50% and not 100%?
- How can a waitlisted patient never be lost from both the queue and the table?
- Why does a failed Redis enqueue not fail the booking?
