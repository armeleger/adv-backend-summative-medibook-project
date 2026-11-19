# Changelog

All notable changes to this project are recorded here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed

- **Availability offered slots in the past** (`GET /api/doctors/:id/availability`).
  Every slot of a past date, and slots earlier today, were reported as
  `available: true` even though booking them returns `422 SLOT_IN_PAST`.
  Each slot now has a `status` (`available`, `booked`, `past`, `day_full`) and
  is only `available` when it can really be booked. Logic moved into the pure
  `describeDaySlots()` helper so it is unit tested.

## [1.0.0] - 2026-11-17

### Added

- Core MediBook backend: schema and seed data, patient/doctor CRUD, booking
  rules with concurrency control, cancellations with server-side refunds,
  SQL statistics and reports, audit log, Redis waitlist with a separate
  worker, localized feedback page, and unit tests.
