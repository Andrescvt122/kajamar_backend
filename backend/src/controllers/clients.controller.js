const prisma = require("../prisma/prismaClient");

// ✅ Obtener todos los clientes
const getClients = async (req, res) => {
  try {
    const clients = await prisma.clientes.findMany({
      orderBy: { id_cliente: "asc" },
    });
    return res.status(200).json(clients);
  } catch (error) {
    console.error("❌ Error al obtener los clientes:", error);
    return res.status(500).json({ error: "Error al obtener los clientes" });
  }
};

// ✅ Obtener un cliente por ID
const getClientById = async (req, res) => {
  const id = parseInt(req.params.id);
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
        "Faltan datos requeridos: nombre_cliente,   tipo_docume, numero_doc, correo_cliente, telefono_cliente o estado_cliente",
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
