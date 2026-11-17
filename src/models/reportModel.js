// Statistics and reports. All counting, summing and percentage maths happens
// in SQL; JavaScript only passes in parameters and returns the rows.
const { pool } = require('./db');
const { APPOINTMENT_STATUS } = require('../config/businessRules');

const { BOOKED, CANCELLED } = APPOINTMENT_STATUS;

// Revenue collected = what was paid minus what was refunded. A BOOKED row has
// refund_amount NULL (treated as 0); a 50% cancellation keeps half its fee.
const NET_REVENUE = 'a.amount_paid - COALESCE(a.refund_amount, 0)';

// One doctor: revenue, upcoming count and utilization over a window of days.
async function getDoctorSummary({ doctorId, now, windowStart, windowEnd, dailyCap, windowDays }) {
  const [rows] = await pool.execute(
    `SELECT d.doctor_id AS doctorId,
            d.full_name AS doctorName,
            d.specialty,
            COALESCE(SUM(${NET_REVENUE}), 0) AS revenueCollected,
            COALESCE(SUM(a.status = ? AND a.appt_datetime > ?), 0) AS upcomingAppointments,
            COALESCE(SUM(a.status = ? AND a.appt_datetime >= ? AND a.appt_datetime < ?), 0) AS bookedInWindow,
            ROUND(
              COALESCE(SUM(a.status = ? AND a.appt_datetime >= ? AND a.appt_datetime < ?), 0)
              * 100 / (? * ?), 1
            ) AS utilizationPercent
     FROM doctors d
     LEFT JOIN appointments a ON a.doctor_id = d.doctor_id
     WHERE d.doctor_id = ?
     GROUP BY d.doctor_id, d.full_name, d.specialty`,
    [
      BOOKED, now,
      BOOKED, windowStart, windowEnd,
      BOOKED, windowStart, windowEnd, dailyCap, windowDays,
      doctorId,
    ],
  );
  return rows[0] ?? null;
}

// One row per day in the window - including days with zero appointments -
// by generating the calendar with a recursive CTE and LEFT JOINing bookings.
async function getDoctorDailyCounts({ doctorId, windowStart, windowDays, dailyCap }) {
  const [rows] = await pool.execute(
    `WITH RECURSIVE calendar (day) AS (
       SELECT CAST(? AS DATE)
       UNION ALL
       SELECT DATE_ADD(day, INTERVAL 1 DAY) FROM calendar
       WHERE day < DATE_ADD(CAST(? AS DATE), INTERVAL ? DAY)
     )
     SELECT DATE_FORMAT(c.day, '%Y-%m-%d') AS day,
            COUNT(a.appointment_id) AS appointments,
            ROUND(COUNT(a.appointment_id) * 100 / ?, 1) AS utilizationPercent
     FROM calendar c
     LEFT JOIN appointments a
       ON a.doctor_id = ?
      AND a.status = ?
      AND a.appt_datetime >= c.day
      AND a.appt_datetime < DATE_ADD(c.day, INTERVAL 1 DAY)
     GROUP BY c.day
     ORDER BY c.day`,
    [windowStart, windowStart, windowDays - 1, dailyCap, doctorId, BOOKED],
  );
  return rows;
}

// Every doctor - LEFT JOIN keeps doctors with no appointments (zeros).
async function getDoctorsReport() {
  const [rows] = await pool.execute(
    `SELECT d.doctor_id AS doctorId,
            d.full_name AS doctorName,
            d.specialty,
            COUNT(a.appointment_id) AS totalAppointments,
            COALESCE(SUM(a.status = ?), 0) AS bookedAppointments,
            COALESCE(SUM(a.status = ?), 0) AS cancelledAppointments,
            COALESCE(SUM(${NET_REVENUE}), 0) AS revenueCollected
     FROM doctors d
     LEFT JOIN appointments a ON a.doctor_id = d.doctor_id
     GROUP BY d.doctor_id, d.full_name, d.specialty
     ORDER BY revenueCollected DESC, d.doctor_id`,
    [BOOKED, CANCELLED],
  );
  return rows;
}

// Every (doctor, date) where booked appointments exceed threshold x cap.
// With a cap of 12 and threshold 0.8 that is > 9.6, i.e. 10 or more.
async function getBusyDays({ dailyCap, threshold }) {
  const [rows] = await pool.execute(
    `SELECT d.doctor_id AS doctorId,
            d.full_name AS doctorName,
            d.specialty,
            DATE_FORMAT(a.appt_datetime, '%Y-%m-%d') AS day,
            COUNT(*) AS bookedAppointments,
            ROUND(COUNT(*) * 100 / ?, 1) AS utilizationPercent
     FROM appointments a
     JOIN doctors d ON d.doctor_id = a.doctor_id
     WHERE a.status = ?
     GROUP BY d.doctor_id, d.full_name, d.specialty, day
     HAVING COUNT(*) > ? * ?
     ORDER BY day, d.doctor_id`,
    [dailyCap, BOOKED, threshold, dailyCap],
  );
  return rows;
}

module.exports = { getDoctorSummary, getDoctorDailyCounts, getDoctorsReport, getBusyDays };
