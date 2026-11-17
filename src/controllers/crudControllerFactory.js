// Patients and doctors share the same CRUD behaviour; this factory builds the
// handlers once instead of copy-pasting them into both controllers.
const AppError = require('../utils/AppError');
const { requireId, assertValid } = require('./requestHelpers');

function createCrudController({ model, validate, resourceName, basePath }) {
  const notFound = (id) => AppError.notFound(`${resourceName} ${id} not found`);

  async function findOr404(id) {
    const record = await model.findById(id);
    if (!record) throw notFound(id);
    return record;
  }

  async function list(req, res) {
    res.json({ data: await model.findAll() });
  }

  async function getOne(req, res) {
    res.json({ data: await findOr404(requireId(req.params.id)) });
  }

  async function create(req, res) {
    const value = assertValid(validate(req.body));
    const id = await model.create(value);
    res.status(201).location(`${basePath}/${id}`).json({ data: await model.findById(id) });
  }

  // PUT replaces the resource (all fields required); PATCH changes some fields.
  const update = ({ partial }) => async (req, res) => {
    const id = requireId(req.params.id);
    const value = assertValid(validate(req.body, { partial }));
    const found = await model.update(id, value);
    if (!found) throw notFound(id);
    res.json({ data: await model.findById(id) });
  };

  // Records with appointments are kept: appointment history (and refunds)
  // must not lose the patient/doctor it refers to (FK ON DELETE RESTRICT).
  async function remove(req, res) {
    const id = requireId(req.params.id);
    await findOr404(id);
    const appointments = await model.countAppointments(id);
    if (appointments > 0) {
      throw AppError.conflict(
        `${resourceName} ${id} has ${appointments} appointment(s) on record and cannot be deleted`,
        'HAS_APPOINTMENTS',
      );
    }
    await model.remove(id);
    res.status(204).end();
  }

  return {
    list,
    getOne,
    create,
    replace: update({ partial: false }),
    modify: update({ partial: true }),
    remove,
    findOr404,
  };
}

module.exports = { createCrudController };
