const { Router } = require('express');
const controller = require('../controllers/patientController');

const router = Router();

router.route('/')
  .get(controller.listPatients)
  .post(controller.createPatient);

router.route('/:id')
  .get(controller.getPatient)
  .put(controller.replacePatient)
  .patch(controller.updatePatient)
  .delete(controller.deletePatient);

router.get('/:id/appointments', controller.listAppointments);

module.exports = router;
