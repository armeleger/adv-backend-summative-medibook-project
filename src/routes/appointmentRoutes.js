const { Router } = require('express');
const controller = require('../controllers/appointmentController');

const router = Router();

router.route('/')
  .get(controller.listAppointments)
  .post(controller.createAppointment);

router.route('/:id')
  .get(controller.getAppointment)
  .delete(controller.deleteAppointment); // cancel (record kept, refund returned)

module.exports = router;
