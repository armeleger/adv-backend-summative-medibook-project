# Changelog

All notable changes to this project are recorded here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- `DELETE /api/waitlist/:doctorId/:date/:patientId` lets a patient leave a
  waitlist (`204`; `404 NOT_ON_WAITLIST` if they are not on it). Removal is
  atomic in Redis, the worker re-checks membership before promoting, and the
  event is logged as `WAITLIST_LEFT`.

### Fixed

- **Availability offered slots in the past** (`GET /api/doctors/:id/availability`).
  Every slot of a past date, and slots earlier today, were reported as
  `available: true` even though booking them returns `422 SLOT_IN_PAST`.
  Each slot now has a `status` (`available`, `booked`, `past`, `day_full`) and
  is only `available` when it can really be booked. Logic moved into the pure
  `describeDaySlots()` helper so it is unit tested.
- **Waitlist lookup for an unknown doctor returned 200** (`GET /api/waitlist`).
  `?doctorId=999` answered `200 { "data": [] }`, hiding a typo in the id. It
  now returns `404 DOCTOR_NOT_FOUND`, consistent with every other endpoint.
- **A malformed job blocked the worker queue forever.** A job that was not
  valid JSON threw inside the worker loop after `BLMOVE` had moved it to
  `medibook:jobs:processing`, so it stayed there and was re-queued (and failed
  again) on every worker restart. Malformed jobs and jobs of an unknown type
  now go straight to `medibook:jobs:failed` and are logged as `JOB_FAILED`.
  Validation lives in the pure `parseJob()` helper, which is unit tested.
- **Retries were used up instantly during an outage.** A failed job was pushed
  straight back onto the queue, so all 5 attempts ran within milliseconds
  while MySQL was down and the job was dead-lettered; the waitlisted patient
  was never promoted even after MySQL came back. Failed jobs now wait in a
  `medibook:jobs:delayed` sorted set with exponential backoff (5s, 10s, 20s,
  40s, 60s; 6 attempts, about 2 minutes) before being retried. Verified by
  stopping MySQL during a promotion: the job retried after 5s and promoted
  the patient once MySQL was back.

## [1.0.0] - 2026-11-17

### Added

- Core MediBook backend: schema and seed data, patient/doctor CRUD, booking
  rules with concurrency control, cancellations with server-side refunds,
  SQL statistics and reports, audit log, Redis waitlist with a separate
  worker, localized feedback page, and unit tests.
