const patientModel = require('../models/patientModel');
const appointmentModel = require('../models/appointmentModel');
const { validatePatient } = require('../utils/validators');
const { createCrudController } = require('./crudControllerFactory');
const { requireId } = require('./requestHelpers');

const crud = createCrudController({
  model: patientModel,
  validate: validatePatient,
  resourceName: 'Patient',
  basePath: '/api/patients',
});

// GET /api/patients/:id/appointments
async function listAppointments(req, res) {
  const id = requireId(req.params.id);
  await crud.findOr404(id);
  res.json({ data: await appointmentModel.findAll({ patientId: id }) });
}

module.exports = {
  listPatients: crud.list,
  getPatient: crud.getOne,
  createPatient: crud.create,
  replacePatient: crud.replace,
  updatePatient: crud.modify,
  deletePatient: crud.remove,
  listAppointments,
};
