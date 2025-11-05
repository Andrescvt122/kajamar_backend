const { client: suppliersApi, isAxiosError } = require('../lib/suppliersApiClient');

const handleRequestError = (res, error, defaultMessage) => {
  if (isAxiosError(error)) {
    const { response, request, message } = error;

    if (response) {
      const statusCode = response.status ?? 500;
      const payload =
        response.data && typeof response.data === 'object'
          ? response.data
          : { message: defaultMessage };
      return res.status(statusCode).json(payload);
    }

    if (request) {
      console.error('No response received from suppliers service:', request);
      return res
        .status(503)
        .json({ message: 'Servicio de proveedores no disponible temporalmente.' });
    }

    console.error('Unexpected Axios error when contacting suppliers service:', message);
    return res.status(500).json({ message: defaultMessage });
  }

  console.error('Unexpected error when contacting suppliers service:', error);
  return res.status(500).json({ message: defaultMessage });
};

const parseNullableFloat = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseNullableInt = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

// Obtener todos los proveedores
exports.getAllSuppliers = async (req, res) => {
  try {
    const { data } = await suppliersApi.get('/');
    res.json(data);
  } catch (error) {
    console.error('Error al obtener proveedores:', error);
    return handleRequestError(res, error, 'Error al obtener los proveedores.');
  }
};

// Obtener un proveedor por ID
exports.getSupplierById = async (req, res) => {
  const { id } = req.params;
  try {
    const { data } = await suppliersApi.get(`/${id}`);
    if (!data) {
      return res.status(404).json({ message: 'Proveedor no encontrado.' });
    }
    res.json(data);
  } catch (error) {
    console.error('Error al obtener proveedor:', error);
    return handleRequestError(res, error, 'Error al obtener el proveedor.');
  }
};

// Crear un nuevo proveedor
exports.createSupplier = async (req, res) => {
  const { nombre, nit, telefono, direccion, estado, descripcion, max_porcentaje_de_devolucion } = req.body;

  const payload = {
    nombre,
    nit: parseNullableInt(nit),
    telefono,
    direccion,
    estado: estado ?? true,
    descripcion,
    max_porcentaje_de_devolucion: parseNullableFloat(max_porcentaje_de_devolucion),
  };

  try {
    const { data } = await suppliersApi.post('/', payload);
    res.status(201).json(data);
  } catch (error) {
    console.error('Error al crear proveedor:', error);
    return handleRequestError(res, error, 'Error al crear el proveedor.');
  }
};

// Actualizar proveedor
exports.updateSupplier = async (req, res) => {
  const { id } = req.params;
  const { nombre, nit, telefono, direccion, estado, descripcion, max_porcentaje_de_devolucion } = req.body;

  const payload = {
    nombre,
    nit: parseNullableInt(nit),
    telefono,
    direccion,
    estado,
    descripcion,
    max_porcentaje_de_devolucion: parseNullableFloat(max_porcentaje_de_devolucion),
  };

  try {
    const { data } = await suppliersApi.put(`/${id}`, payload);
    res.json(data);
  } catch (error) {
    console.error('Error al actualizar proveedor:', error);
    return handleRequestError(res, error, 'Error al actualizar el proveedor.');
  }
};

// Eliminar proveedor
exports.deleteSupplier = async (req, res) => {
  const { id } = req.params;

  try {
    const { data } = await suppliersApi.delete(`/${id}`);
    res.json(data ?? { message: 'Proveedor eliminado correctamente.' });
  } catch (error) {
    console.error('Error al eliminar proveedor:', error);
    return handleRequestError(res, error, 'Error al eliminar el proveedor.');
  }
};
