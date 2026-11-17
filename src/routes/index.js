const { Router } = require('express');

const router = Router();

router.use('/patients', require('./patientRoutes'));
router.use('/doctors', require('./doctorRoutes'));
router.use('/appointments', require('./appointmentRoutes'));
router.use('/waitlist', require('./waitlistRoutes'));
router.use('/reports', require('./reportRoutes'));

module.exports = router;
