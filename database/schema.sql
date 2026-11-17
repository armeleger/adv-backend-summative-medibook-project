-- =============================================================================
-- MediBook - Clinic Appointment System
-- Schema (3NF). Requires MySQL 8.0.16+ (CHECK constraints are enforced).
--
-- Normalization of the original spreadsheet:
--   * patient_name/email/phone depend only on the patient  -> patients
--   * doctor_name/specialty/fee/room depend only on doctor -> doctors
--   * appt_datetime/amount_paid/booked_on depend on the
--     booking itself                                       -> appointments
--   appointments keeps only the two foreign keys, so no patient or doctor
--   attribute is repeated per booking (no transitive dependencies).
--   amount_paid stays on appointments: it is what was actually charged for
--   that booking (AP-002 paid 120.00 against a 150.00 fee), so it is not
--   derivable from the doctor's current fee.
-- =============================================================================

DROP DATABASE IF EXISTS medibook;
CREATE DATABASE medibook CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE medibook;

-- -----------------------------------------------------------------------------
-- patients: people who book appointments
-- -----------------------------------------------------------------------------
CREATE TABLE patients (
  patient_id  INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  full_name   VARCHAR(100)  NOT NULL,
  email       VARCHAR(255)  NOT NULL,
  phone       VARCHAR(20)   NOT NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT pk_patients PRIMARY KEY (patient_id),
  CONSTRAINT uq_patients_email UNIQUE (email),
  CONSTRAINT chk_patients_full_name CHECK (CHAR_LENGTH(TRIM(full_name)) >= 2)
) ENGINE = InnoDB;

-- -----------------------------------------------------------------------------
-- doctors: specialty, consultation fee and consulting room
-- -----------------------------------------------------------------------------
CREATE TABLE doctors (
  doctor_id         INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  full_name         VARCHAR(100)   NOT NULL,
  specialty         VARCHAR(100)   NOT NULL,
  consultation_fee  DECIMAL(10, 2) NOT NULL,
  room              VARCHAR(10)    NOT NULL,
  created_at        DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT pk_doctors PRIMARY KEY (doctor_id),
  CONSTRAINT chk_doctors_full_name CHECK (CHAR_LENGTH(TRIM(full_name)) >= 2),
  CONSTRAINT chk_doctors_fee CHECK (consultation_fee >= 0)
) ENGINE = InnoDB;

-- -----------------------------------------------------------------------------
-- appointments: a patient's booking with a doctor at a date/time.
-- Each patient has 0..N appointments; each doctor has 0..N appointments.
--
-- Cancellation is a status change, not a DELETE: the row (and its refund
-- figures) is kept for refund history. The refund lives on the same row, so
-- "cancel + record refund" is one UPDATE and cannot half-succeed.
--
-- active_flag is 1 while the appointment is BOOKED and NULL once CANCELLED.
-- MySQL UNIQUE indexes treat NULLs as distinct, so:
--   * a doctor can never hold two BOOKED appointments at the same date/time,
--   * but a CANCELLED row no longer blocks the slot, which becomes rebookable.
-- -----------------------------------------------------------------------------
CREATE TABLE appointments (
  appointment_id  INT UNSIGNED                NOT NULL AUTO_INCREMENT,
  patient_id      INT UNSIGNED                NOT NULL,
  doctor_id       INT UNSIGNED                NOT NULL,
  appt_datetime   DATETIME                    NOT NULL,
  amount_paid     DECIMAL(10, 2)              NOT NULL,
  status          ENUM('BOOKED', 'CANCELLED') NOT NULL DEFAULT 'BOOKED',
  booked_at       DATETIME                    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at    DATETIME                    NULL,
  refund_percent  TINYINT UNSIGNED            NULL,
  refund_amount   DECIMAL(10, 2)              NULL,
  active_flag     TINYINT UNSIGNED
                  AS (IF(status = 'BOOKED', 1, NULL)) STORED,

  CONSTRAINT pk_appointments PRIMARY KEY (appointment_id),

  CONSTRAINT fk_appointments_patient FOREIGN KEY (patient_id)
    REFERENCES patients (patient_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_appointments_doctor FOREIGN KEY (doctor_id)
    REFERENCES doctors (doctor_id) ON DELETE RESTRICT ON UPDATE CASCADE,

  -- A doctor cannot have two (active) appointments at the same date/time.
  CONSTRAINT uq_doctor_active_slot UNIQUE (doctor_id, appt_datetime, active_flag),
  -- A patient cannot be in two (active) appointments at the same date/time.
  CONSTRAINT uq_patient_active_slot UNIQUE (patient_id, appt_datetime, active_flag),

  -- Slots start on a 30-minute boundary...
  CONSTRAINT chk_appt_slot_boundary
    CHECK (MINUTE(appt_datetime) IN (0, 30) AND SECOND(appt_datetime) = 0),
  -- ...within working hours 09:00-17:00 (last slot starts 16:30).
  CONSTRAINT chk_appt_working_hours
    CHECK (TIME(appt_datetime) BETWEEN '09:00:00' AND '16:30:00'),

  CONSTRAINT chk_appt_amount_paid CHECK (amount_paid >= 0),
  CONSTRAINT chk_appt_refund_percent CHECK (refund_percent IN (0, 50, 100)),
  CONSTRAINT chk_appt_refund_amount CHECK (refund_amount BETWEEN 0 AND amount_paid),
  -- A BOOKED row has no cancellation data; a CANCELLED row must have all of it.
  CONSTRAINT chk_appt_cancellation_record CHECK (
    (status = 'BOOKED'    AND cancelled_at IS NULL     AND refund_percent IS NULL     AND refund_amount IS NULL)
    OR
    (status = 'CANCELLED' AND cancelled_at IS NOT NULL AND refund_percent IS NOT NULL AND refund_amount IS NOT NULL)
  ),

  -- Speeds up the busy-days report and "upcoming" queries.
  INDEX idx_appointments_status_datetime (status, appt_datetime)
) ENGINE = InnoDB;
