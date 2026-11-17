-- =============================================================================
-- MediBook seed data. Run after schema.sql.
--
-- Dates are relative to the day the seed runs (CURDATE()), so the "upcoming"
-- appointments are always in the future whenever you load the data.
--
-- Required cases:
--   * Dr. Esi Quaye (doctor 4) has NO appointments -> appears with zeros in
--     the doctors report.
--   * Dr. Kwabena Boateng (doctor 1) has 11 appointments three days from now
--     (near the 12-per-day cap). The working day has 16 half-hour slots, but
--     only ONE more booking is allowed; after that the day is full and new
--     requests are offered the waitlist.
--     11/12 = 91.7% > 80%, so this day shows in the busy-days report.
--   * Past, upcoming and cancelled (refunded) appointments for revenue/history.
-- =============================================================================

USE medibook;

SET @today    = CURDATE();
SET @past14   = DATE_SUB(@today, INTERVAL 14 DAY);
SET @past10   = DATE_SUB(@today, INTERVAL 10 DAY);
SET @past5    = DATE_SUB(@today, INTERVAL 5 DAY);
SET @plus1    = DATE_ADD(@today, INTERVAL 1 DAY);
SET @plus2    = DATE_ADD(@today, INTERVAL 2 DAY);
SET @plus3    = DATE_ADD(@today, INTERVAL 3 DAY);
SET @plus5    = DATE_ADD(@today, INTERVAL 5 DAY);
SET @plus10   = DATE_ADD(@today, INTERVAL 10 DAY);

INSERT INTO patients (patient_id, full_name, email, phone) VALUES
  (1,  'Ama Mensah',      'ama@mail.com',     '0244-111-222'),
  (2,  'Kojo Owusu',      'kojo@mail.com',    '0555-333-444'),
  (3,  'Efua Asante',     'efua@mail.com',    '0201-555-666'),
  (4,  'Yaw Darko',       'yaw@mail.com',     '0277-777-888'),
  (5,  'Akosua Boakye',   'akosua@mail.com',  '0243-999-000'),
  (6,  'Kwame Appiah',    'kwame@mail.com',   '0546-121-343'),
  (7,  'Adwoa Sarpong',   'adwoa@mail.com',   '0208-565-787'),
  (8,  'Kofi Antwi',      'kofi@mail.com',    '0249-909-101'),
  (9,  'Abena Osei',      'abena@mail.com',   '0557-232-454'),
  (10, 'Kwesi Ofori',     'kwesi@mail.com',   '0266-676-898'),
  (11, 'Esi Amponsah',    'esi@mail.com',     '0240-414-616'),
  (12, 'Nana Agyeman',    'nana@mail.com',    '0503-838-050'),
  (13, 'Afia Gyamfi',     'afia@mail.com',    '0272-262-484');

INSERT INTO doctors (doctor_id, full_name, specialty, consultation_fee, room) VALUES
  (1, 'Dr. Kwabena Boateng', 'Dermatology',      150.00, 'R-12'),
  (2, 'Dr. Abena Adjei',     'Paediatrics',      100.00, 'R-03'),
  (3, 'Dr. Kofi Larbi',      'Cardiology',       250.00, 'R-07'),
  (4, 'Dr. Esi Quaye',       'General Practice',  80.00, 'R-01');

-- Past, completed appointments (mirrors the original spreadsheet rows).
INSERT INTO appointments (patient_id, doctor_id, appt_datetime, amount_paid, booked_at) VALUES
  (1, 1, TIMESTAMP(@past14, '09:00:00'), 150.00, TIMESTAMP(DATE_SUB(@past14, INTERVAL 30 DAY), '10:15:00')),
  (2, 1, TIMESTAMP(@past14, '09:30:00'), 120.00, TIMESTAMP(DATE_SUB(@past14, INTERVAL 29 DAY), '14:40:00')),
  (1, 2, TIMESTAMP(@past10, '10:00:00'), 100.00, TIMESTAMP(DATE_SUB(@past10, INTERVAL 20 DAY), '08:05:00')),
  (4, 3, TIMESTAMP(@past10, '11:00:00'), 250.00, TIMESTAMP(DATE_SUB(@past10, INTERVAL 12 DAY), '16:20:00'));

-- Past appointment cancelled 3 days ahead (> 48h notice -> 100% refund).
INSERT INTO appointments (patient_id, doctor_id, appt_datetime, amount_paid, status, booked_at, cancelled_at, refund_percent, refund_amount) VALUES
  (3, 2, TIMESTAMP(@past5, '11:00:00'), 100.00, 'CANCELLED',
   TIMESTAMP(DATE_SUB(@past5, INTERVAL 15 DAY), '09:00:00'),
   TIMESTAMP(DATE_SUB(@past5, INTERVAL 3 DAY), '12:00:00'), 100, 100.00);

-- Upcoming appointments.
INSERT INTO appointments (patient_id, doctor_id, appt_datetime, amount_paid) VALUES
  (2, 2, TIMESTAMP(@plus1,  '10:00:00'), 100.00),
  (5, 2, TIMESTAMP(@plus2,  '14:00:00'), 100.00),
  (6, 3, TIMESTAMP(@plus5,  '09:00:00'), 250.00),
  (7, 3, TIMESTAMP(@plus5,  '09:30:00'), 250.00),
  (1, 2, TIMESTAMP(@plus10, '11:30:00'), 100.00);

-- Near-cap day: Dr. Boateng, 11 of 12 allowed appointments booked.
INSERT INTO appointments (patient_id, doctor_id, appt_datetime, amount_paid) VALUES
  (1,  1, TIMESTAMP(@plus3, '09:00:00'), 150.00),
  (2,  1, TIMESTAMP(@plus3, '09:30:00'), 150.00),
  (3,  1, TIMESTAMP(@plus3, '10:00:00'), 150.00),
  (4,  1, TIMESTAMP(@plus3, '10:30:00'), 150.00),
  (5,  1, TIMESTAMP(@plus3, '11:00:00'), 150.00),
  (6,  1, TIMESTAMP(@plus3, '11:30:00'), 150.00),
  (7,  1, TIMESTAMP(@plus3, '13:00:00'), 150.00),
  (8,  1, TIMESTAMP(@plus3, '13:30:00'), 150.00),
  (9,  1, TIMESTAMP(@plus3, '14:00:00'), 150.00),
  (10, 1, TIMESTAMP(@plus3, '14:30:00'), 150.00),
  (11, 1, TIMESTAMP(@plus3, '15:00:00'), 150.00);

-- A cancelled booking on the same busy day: kept for refund history, does not
-- count toward the cap and does not block 15:30 (it is rebookable).
INSERT INTO appointments (patient_id, doctor_id, appt_datetime, amount_paid, status, booked_at, cancelled_at, refund_percent, refund_amount) VALUES
  (12, 1, TIMESTAMP(@plus3, '15:30:00'), 150.00, 'CANCELLED',
   TIMESTAMP(DATE_SUB(@today, INTERVAL 7 DAY), '09:30:00'),
   TIMESTAMP(DATE_SUB(@today, INTERVAL 1 DAY), '17:45:00'), 100, 150.00);
