// backend/controllers/clients.controller.js
const prisma = require("../prisma/prismaClient");

// ======================
// Constante: Cliente de Caja FIJO
// ======================
const CAJA_ID = 0;

const clienteCaja = {
  id_cliente: CAJA_ID,
  nombre_cliente: "Cliente de Caja",
  tipo_docume: "N/A",
  numero_doc: "N/A",
  correo_cliente: "caja@correo.com",
  telefono_cliente: "N/A",
  estado_cliente: true,
};

// ✅ Obtener todos los clientes (Cliente de Caja SIEMPRE primero)
const getClients = async (req, res) => {
  try {
    const clients = await prisma.clientes.findMany({
      orderBy: { id_cliente: "asc" },
    });

    // Evita duplicado si algún día alguien creó un cliente con id 0 (raro, pero por si acaso)
    const filtered = clients.filter((c) => c.id_cliente !== CAJA_ID);

    return res.status(200).json([clienteCaja, ...filtered]);
  } catch (error) {
    console.error("❌ Error al obtener los clientes:", error);
    return res.status(500).json({ error: "Error al obtener los clientes" });
  }
};

// ✅ Obtener un cliente por ID (incluye Cliente de Caja)
const getClientById = async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (id === CAJA_ID) {
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

// ✅ Buscar clientes por nombre/documento/correo/id (incluye Cliente de Caja)
const searchClients = async (req, res) => {
  const qRaw = String(req.params.q || "").trim();

  if (!qRaw) {
    return res.status(400).json({ error: "Falta parámetro de búsqueda" });
  }

  const q = qRaw.toLowerCase();
  const idNumber = Number(qRaw);
  const isNumeric = !Number.isNaN(idNumber);

  // Si buscan 0 => Cliente de Caja
  if (isNumeric && idNumber === CAJA_ID) {
    return res.status(200).json([clienteCaja]);
  }

  // Si buscan por "cliente de caja" => también lo devolvemos
  if (q.includes("cliente de caja") || q.includes("caja")) {
    return res.status(200).json([clienteCaja]);
  }

  try {
    const allClients = await prisma.clientes.findMany({
      orderBy: { id_cliente: "asc" },
    });

    const filtered = allClients.filter((c) => {
      const nombre = (c.nombre_cliente || "").toLowerCase();
      const doc = (c.numero_doc || "").toString().toLowerCase();
      const correo = (c.correo_cliente || "").toLowerCase();
      const id = String(c.id_cliente);

      return (
        nombre.includes(q) ||
        doc.includes(q) ||
        correo.includes(q) ||
        (isNumeric && id === String(idNumber))
      );
    });

    if (!filtered || filtered.length === 0) {
      return res.status(404).json({ error: "No se encontró ningún cliente" });
    }

    return res.status(200).json(filtered);
  } catch (error) {
    console.error("❌ Error al buscar clientes:", error);
    return res.status(500).json({ error: "Error al buscar los clientes" });
  }
};

// ✅ Crear un nuevo cliente
const createClient = async (req, res) => {
  let {
    nombre_cliente,
    tipo_docume,
    numero_doc,
    correo_cliente,
    telefono_cliente,
    estado_cliente,
  } = req.body;

  correo_cliente =
    correo_cliente && correo_cliente.toString().trim() !== ""
      ? correo_cliente.toString().trim()
      : null;

  telefono_cliente =
    telefono_cliente && telefono_cliente.toString().trim() !== ""
      ? telefono_cliente.toString().trim()
      : null;

  if (!nombre_cliente || !tipo_docume || !numero_doc || estado_cliente == null) {
    return res.status(400).json({
      error:
        "Faltan datos requeridos: nombre_cliente, tipo_docume, numero_doc o estado_cliente",
    });
  }

  try {
    if (correo_cliente) {
      const existingEmail = await prisma.clientes.findUnique({
        where: { correo_cliente },
      });

      if (existingEmail) {
        return res.status(400).json({ error: "El correo ya está registrado" });
      }
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

// ✅ Actualizar un cliente (NO permitir Caja)
const updateClient = async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (id === CAJA_ID) {
    return res
      .status(400)
      .json({ error: "No se puede editar el Cliente de Caja" });
  }

  let {
    nombre_cliente,
    tipo_docume,
    numero_doc,
    correo_cliente,
    telefono_cliente,
    estado_cliente,
  } = req.body;

  correo_cliente =
    correo_cliente && correo_cliente.toString().trim() !== ""
      ? correo_cliente.toString().trim()
      : null;

  telefono_cliente =
    telefono_cliente && telefono_cliente.toString().trim() !== ""
      ? telefono_cliente.toString().trim()
      : null;

  try {
    const existing = await prisma.clientes.findUnique({
      where: { id_cliente: id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    if (correo_cliente && correo_cliente !== existing.correo_cliente) {
      const emailUsed = await prisma.clientes.findUnique({
        where: { correo_cliente },
      });

      if (emailUsed && emailUsed.id_cliente !== id) {
        return res.status(400).json({
          error: "El correo ya está registrado por otro cliente",
        });
      }
    }

    const updated = await prisma.clientes.update({
      where: { id_cliente: id },
      data: {
        nombre_cliente:
          nombre_cliente !== undefined ? nombre_cliente : existing.nombre_cliente,
        tipo_docume:
          tipo_docume !== undefined ? tipo_docume : existing.tipo_docume,
        numero_doc: numero_doc !== undefined ? numero_doc : existing.numero_doc,
        correo_cliente:
          correo_cliente !== undefined
            ? correo_cliente
            : existing.correo_cliente,
        telefono_cliente:
          telefono_cliente !== undefined
            ? telefono_cliente
            : existing.telefono_cliente,
        estado_cliente:
          estado_cliente !== undefined
            ? estado_cliente
            : existing.estado_cliente,
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

// ✅ Eliminar un cliente (NO permitir Caja)
const deleteClient = async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (id === CAJA_ID) {
    return res
      .status(400)
      .json({ message: "No se puede eliminar el Cliente de Caja" });
  }

  try {
    const existing = await prisma.clientes.findUnique({
      where: { id_cliente: id },
    });

    if (!existing) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    await prisma.clientes.delete({
      where: { id_cliente: id },
    });

    return res.status(200).json({ message: "Cliente eliminado correctamente" });
  } catch (error) {
    console.error("❌ Error al eliminar el cliente:", error);

    // ✅ Si tiene ventas asociadas (FK RESTRICT)
    // Prisma: P2003 => Foreign key constraint failed
    if (error?.code === "P2003") {
      return res.status(409).json({
        message:
          "No se puede eliminar el cliente porque hay una venta asociada con el cliente",
      });
    }

    return res.status(500).json({
      message: "No se pudo eliminar el cliente",
    });
  }
};


module.exports = {
  getClients,
  getClientById,
  searchClients,
  createClient,
  updateClient,
  deleteClient,
};
