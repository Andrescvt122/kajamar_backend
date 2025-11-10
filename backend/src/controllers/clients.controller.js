const prisma = require("../prisma/prismaClient");

// ✅ Obtener todos los clientes
const getClients = async (req, res) => {
  try {
    const clients = await prisma.clientes.findMany({
      orderBy: { id_cliente: "asc" },
    });

    // Cliente de Caja (fijo)
    const clienteCaja = {
      id_cliente: 0, // ID especial para el cliente de caja
      nombre_cliente: "Cliente de Caja",
      tipo_docume: "N/A",
      numero_doc: "N/A",
      correo_cliente: "caja@correo.com",
      telefono_cliente: "N/A",
      estado_cliente: true,
    };

    // Devolver Cliente de Caja + clientes reales
    return res.status(200).json([clienteCaja, ...clients]);
  } catch (error) {
    console.error("❌ Error al obtener los clientes:", error);
    return res.status(500).json({ error: "Error al obtener los clientes" });
  }
};

// ✅ Obtener un cliente por ID
const getClientById = async (req, res) => {
  const id = parseInt(req.params.id);

  // Verificar si es el Cliente de Caja
  if (id === 0) {
    const clienteCaja = {
      id_cliente: 0,
      nombre_cliente: "Cliente de Caja",
      tipo_docume: "N/A",
      numero_doc: "N/A",
      correo_cliente: "caja@correo.com",
      telefono_cliente: "N/A",
      estado_cliente: true,
    };
    return res.status(200).json(clienteCaja);
  }

  try {
    const client = await prisma.clientes.findUnique({
      where: { id_cliente: id },
    });

    if (!client) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    return res.status(200).json(client);
  } catch (error) {
    console.error("❌ Error al obtener el cliente:", error);
    return res.status(500).json({ error: "Error al obtener el cliente" });
  }
};

// ✅ Crear un nuevo cliente
const createClient = async (req, res) => {
  const {
    nombre_cliente,
    tipo_docume,
    numero_doc,
    correo_cliente,
    telefono_cliente,
    estado_cliente,
  } = req.body;

  if (
    !nombre_cliente ||
    !tipo_docume ||
    !numero_doc ||
    !correo_cliente ||
    !telefono_cliente ||
    estado_cliente === undefined
  ) {
    return res.status(400).json({
      error:
        "Faltan datos requeridos: nombre_cliente, tipo_docume, numero_doc, correo_cliente, telefono_cliente o estado_cliente",
    });
  }

  try {
    const existingEmail = await prisma.clientes.findUnique({
      where: { correo_cliente },
    });

    if (existingEmail) {
      return res.status(400).json({ error: "El correo ya está registrado" });
    }

    const client = await prisma.clientes.create({
      data: {
        nombre_cliente,
        tipo_docume,
        numero_doc,
        correo_cliente,
        telefono_cliente,
        estado_cliente,
      },
    });

    return res.status(201).json({
      message: "✅ Cliente creado correctamente",
      client,
    });
  } catch (error) {
    console.error("❌ Error al crear el cliente:", error);
    return res.status(500).json({ error: "Error al crear el cliente" });
  }
};

// ✅ Actualizar un cliente existente
const updateClient = async (req, res) => {
  const id = parseInt(req.params.id);

  // No permitir editar el Cliente de Caja
  if (id === 0) {
    return res.status(400).json({ error: "No se puede editar el Cliente de Caja" });
  }

  const {
    nombre_cliente,
    tipo_docume,
    numero_doc,
    correo_cliente,
    telefono_cliente,
    estado_cliente,
  } = req.body;

  try {
    const existing = await prisma.clientes.findUnique({
      where: { id_cliente: id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    const updated = await prisma.clientes.update({
      where: { id_cliente: id },
      data: {
        nombre_cliente: nombre_cliente ?? existing.nombre_cliente,
        tipo_docume: tipo_docume ?? existing.tipo_docume,
        numero_doc: numero_doc ?? existing.numero_doc,
        correo_cliente: correo_cliente ?? existing.correo_cliente,
        telefono_cliente: telefono_cliente ?? existing.telefono_cliente,
        estado_cliente: estado_cliente ?? existing.estado_cliente,
      },
    });

    return res.status(200).json({
      message: "✅ Cliente actualizado correctamente",
      client: updated,
    });
  } catch (error) {
    console.error("❌ Error al actualizar el cliente:", error);
    return res.status(500).json({ error: "Error al actualizar el cliente" });
  }
};

// ✅ Eliminar un cliente
const deleteClient = async (req, res) => {
  const id = parseInt(req.params.id);

  // No permitir eliminar el Cliente de Caja
  if (id === 0) {
    return res.status(400).json({ error: "No se puede eliminar el Cliente de Caja" });
  }

  try {
    const existing = await prisma.clientes.findUnique({
      where: { id_cliente: id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    await prisma.clientes.delete({
      where: { id_cliente: id },
    });

    return res.status(200).json({ message: "✅ Cliente eliminado correctamente" });
  } catch (error) {
    console.error("❌ Error al eliminar el cliente:", error);
    return res.status(500).json({ error: "Error al eliminar el cliente" });
  }
};

module.exports = {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
};