const { Router } = require('express');
const controller = require('../controllers/feedbackController');

const router = Router();

router.route('/')
  .get(controller.showForm)
  .post(controller.submitForm);

module.exports = router;
