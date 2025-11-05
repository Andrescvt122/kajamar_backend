const prisma = require('../prisma/prismaClient');

// Obtener todos los proveedores
exports.getAllSuppliers = async (req, res) => {
  try {
    const suppliers = await prisma.proveedores.findMany({
      orderBy: { nombre: 'asc' },
    });
    res.json(suppliers);
  } catch (error) {
    console.error('Error al obtener proveedores:', error);
    res.status(500).json({ message: 'Error al obtener los proveedores.' });
  }
};

// Obtener un proveedor por ID
exports.getSupplierById = async (req, res) => {
  const { id } = req.params;
  try {
    const supplier = await prisma.proveedores.findUnique({
      where: { id_proveedor: parseInt(id) },
    });
    if (!supplier) {
      return res.status(404).json({ message: 'Proveedor no encontrado.' });
    }
    res.json(supplier);
  } catch (error) {
    console.error('Error al obtener proveedor:', error);
    res.status(500).json({ message: 'Error al obtener el proveedor.' });
  }
};

// Crear un nuevo proveedor
exports.createSupplier = async (req, res) => {
  const { nombre, nit, telefono, direccion, estado, descripcion, max_porcentaje_de_devolucion } = req.body;

  try {
    const newSupplier = await prisma.proveedores.create({
      data: {
        nombre,
        nit: parseInt(nit),
        telefono,
        direccion,
        estado: estado ?? true,
        descripcion,
        max_porcentaje_de_devolucion: max_porcentaje_de_devolucion
          ? parseFloat(max_porcentaje_de_devolucion)
          : null,
      },
    });
    res.status(201).json(newSupplier);
  } catch (error) {
    console.error('Error al crear proveedor:', error);
    res.status(500).json({ message: 'Error al crear el proveedor.' });
  }
};

// Actualizar proveedor
exports.updateSupplier = async (req, res) => {
  const { id } = req.params;
  const { nombre, nit, telefono, direccion, estado, descripcion, max_porcentaje_de_devolucion } = req.body;

  try {
    const supplier = await prisma.proveedores.findUnique({
      where: { id_proveedor: parseInt(id) },
    });

    if (!supplier) {
      return res.status(404).json({ message: 'Proveedor no encontrado.' });
    }

    const updatedSupplier = await prisma.proveedores.update({
      where: { id_proveedor: parseInt(id) },
      data: {
        nombre,
        nit: parseInt(nit),
        telefono,
        direccion,
        estado,
        descripcion,
        max_porcentaje_de_devolucion: max_porcentaje_de_devolucion
          ? parseFloat(max_porcentaje_de_devolucion)
          : null,
      },
    });

    res.json(updatedSupplier);
  } catch (error) {
    console.error('Error al actualizar proveedor:', error);
    res.status(500).json({ message: 'Error al actualizar el proveedor.' });
  }
};

// Eliminar proveedor
exports.deleteSupplier = async (req, res) => {
  const { id } = req.params;

  try {
    const supplier = await prisma.proveedores.findUnique({
      where: { id_proveedor: parseInt(id) },
    });

    if (!supplier) {
      return res.status(404).json({ message: 'Proveedor no encontrado.' });
    }

    await prisma.proveedores.delete({
      where: { id_proveedor: parseInt(id) },
    });

    res.json({ message: 'Proveedor eliminado correctamente.' });
  } catch (error) {
    console.error('Error al eliminar proveedor:', error);
    res.status(500).json({ message: 'Error al eliminar el proveedor.' });
  }
};
