# Recreating the Schema Diagram in Miro

A step-by-step guide to drawing the MediBook schema in Miro so it is simple to read and still meets every point of the Part A rubric. It matches `database/schema.sql` exactly. Don't add or rename anything without changing the SQL too.

Target: **one board, three tables, two relationship lines, one constraints note.** About 45–60 minutes.

---

## 1. Layout

```
┌──────────────┐          ┌──────────────────┐          ┌──────────────┐
│   patients   │ 1      N │   appointments   │ N      1 │   doctors    │
│              ├──────────┤                  ├──────────┤              │
└──────────────┘          └──────────────────┘          └──────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ Business-rule constraints                                            │
└──────────────────────────────────────────────────────────────────────┘
```

Put `appointments` in the middle because it links the other two. Line the three tables up on the same top edge.

## 2. Colours

Pick colours once and keep them throughout:

| Element | Suggestion |
|---|---|
| `patients` header | blue |
| `appointments` header | purple |
| `doctors` header | green |
| PK markers | gold / bold + underlined column name |
| FK markers | red |
| Constraint note | light purple sticky or shape |

## 3. Tables

In Miro, use a **Table** (or an "Entity" shape from the ERD template). Use three columns: **Key**, **Column**, **Type + constraints**.

Legend to put on the board: `PK` primary key · `FK` foreign key · `UQ` unique · `U1`/`U2` part of a composite unique key · `NN` NOT NULL · `CHK` check.

### patients

| Key | Column | Type | Constraints |
|---|---|---|---|
| PK | patient_id | INT UNSIGNED | NN, AUTO_INCREMENT |
| | full_name | VARCHAR(100) | NN, CHK length ≥ 2 |
| UQ | email | VARCHAR(255) | NN, UNIQUE |
| | phone | VARCHAR(20) | NN |
| | created_at | DATETIME | NN, DEFAULT now |
| | updated_at | DATETIME | NN, ON UPDATE now |

### doctors

| Key | Column | Type | Constraints |
|---|---|---|---|
| PK | doctor_id | INT UNSIGNED | NN, AUTO_INCREMENT |
| | full_name | VARCHAR(100) | NN, CHK length ≥ 2 |
| | specialty | VARCHAR(100) | NN |
| | consultation_fee | DECIMAL(10,2) | NN, CHK ≥ 0 |
| | room | VARCHAR(10) | NN |
| | created_at | DATETIME | NN, DEFAULT now |
| | updated_at | DATETIME | NN, ON UPDATE now |

### appointments

| Key | Column | Type | Constraints |
|---|---|---|---|
| PK | appointment_id | INT UNSIGNED | NN, AUTO_INCREMENT |
| FK, U2 | patient_id | INT UNSIGNED | NN → patients.patient_id |
| FK, U1 | doctor_id | INT UNSIGNED | NN → doctors.doctor_id |
| U1, U2 | appt_datetime | DATETIME | NN, CHK :00/:30, 09:00–16:30 |
| | amount_paid | DECIMAL(10,2) | NN, CHK ≥ 0 |
| | status | ENUM('BOOKED','CANCELLED') | NN, DEFAULT 'BOOKED' |
| | booked_at | DATETIME | NN, DEFAULT now |
| | cancelled_at | DATETIME | NULL |
| | refund_percent | TINYINT UNSIGNED | NULL, CHK IN (0, 50, 100) |
| | refund_amount | DECIMAL(10,2) | NULL, CHK 0 … amount_paid |
| U1, U2 | active_flag | TINYINT UNSIGNED | GENERATED: 1 if BOOKED, else NULL |

## 4. Relationships

Use Miro's connector with **crow's-foot** ends (connector → line ends → "ERD" options):

| From | To | patients/doctors end | appointments end | Label |
|---|---|---|---|---|
| `patients.patient_id` | `appointments.patient_id` | one and only one (‖) | zero or many (○<) | `1 : N` |
| `doctors.doctor_id` | `appointments.doctor_id` | one and only one (‖) | zero or many (○<) | `1 : N` |

Attach each line to the **key rows**, not just the table edges, so it is obvious which columns link.

## 5. Constraints note

Make one wide note under the tables. Put the first rule in a bold box: it is the one the rubric names explicitly.

> **U1 — `uq_doctor_active_slot` UNIQUE (doctor_id, appt_datetime, active_flag)**
> A doctor can never have two appointments at the same date/time. `active_flag` is NULL for cancelled rows and UNIQUE ignores NULLs, so a cancelled slot becomes bookable again while its record is kept.

Then list the rest:

- **U2** `uq_patient_active_slot` UNIQUE (patient_id, appt_datetime, active_flag): a patient is never booked twice at the same time
- **CHK** `chk_appt_slot_boundary`: minute is 00 or 30, seconds 0
- **CHK** `chk_appt_working_hours`: time between 09:00 and 16:30 (ends by 17:00)
- **CHK** `chk_appt_refund_percent`: 0, 50 or 100
- **CHK** `chk_appt_refund_amount`: 0 ≤ refund ≤ amount_paid
- **CHK** `chk_appt_cancellation_record`: BOOKED ⇒ no cancellation data; CANCELLED ⇒ cancelled_at + refund required
- **FK** both foreign keys `ON DELETE RESTRICT`: history is never orphaned
- **UQ** `uq_patients_email`; **CHK** `chk_doctors_fee` ≥ 0
- *In application code (cannot be CHECK):* booking must be in the future; at most 12 BOOKED appointments per doctor per day

## 6. Rubric check before exporting

- [ ] All 3 tables, every column, every MySQL type
- [ ] PKs and FKs clearly marked
- [ ] Both relationships drawn with crow's feet and labelled 1 : N
- [ ] NOT NULL, UNIQUE and CHECK constraints visible
- [ ] The doctor/date-time UNIQUE rule is clearly visible
- [ ] Matches `database/schema.sql` (names and types)

## 7. Export and commit (Mon 23 Nov)

1. Miro → *Export* → *Save as image* (PNG, high quality) and optionally *PDF*.
2. Save it as `schema-diagram.png` (and `schema-diagram.pdf`) in the repo root, replacing the current file.
3. Delete `schema-diagram.svg` so the repo has only one version of the diagram.
4. Commit: `docs(db): replace schema diagram with Miro version`.
