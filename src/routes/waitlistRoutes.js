const { Router } = require('express');
const controller = require('../controllers/waitlistController');

const router = Router();

router.route('/')
  .get(controller.getWaitlist)
  .post(controller.joinWaitlist);

router.delete('/:doctorId/:date/:patientId', controller.leaveWaitlist);

module.exports = router;
