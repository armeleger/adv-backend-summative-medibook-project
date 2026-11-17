const { Router } = require('express');
const controller = require('../controllers/doctorController');

const router = Router();

router.route('/')
  .get(controller.listDoctors)
  .post(controller.createDoctor);

router.route('/:id')
  .get(controller.getDoctor)
  .put(controller.replaceDoctor)
  .patch(controller.updateDoctor)
  .delete(controller.deleteDoctor);

router.get('/:id/stats', controller.getStats);
router.get('/:id/availability', controller.getAvailability);
router.get('/:id/appointments', controller.listAppointments);

module.exports = router;
