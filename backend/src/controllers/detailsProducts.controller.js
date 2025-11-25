// backend/src/controllers/detalle_productos.controller.js
const prisma = require("../prisma/prismaClient");

// 🟢 Crear detalle de producto
const createDetailProduct = async (req, res) => {
  const data = req.body;
  try {
    const register = await prisma.$transaction(async (tx) => {
      const detailProduct = await tx.detalle_productos.create({
        data: {
          id_producto: data.id_producto,
          codigo_barras_producto_compra: data.codigo_barras,
          fecha_vencimiento: data.fecha_vencimiento
            ? new Date(data.fecha_vencimiento)
            : null,
          stock_producto: data.stock_producto,
          es_devolucion: data.es_devolucion ?? false,
          estado: true,
        },
      });

      // Actualiza el stock total del producto
      await tx.productos.update({
        where: { id_producto: data.id_producto },
        data: {
          stock_actual: { increment: data.stock_producto },
        },
      });

      return detailProduct;
    });
    return res.status(201).json(register);
  } catch (error) {
    console.error("❌ Error al crear el detalle del producto:", error);
    return res
      .status(500)
      .json({ message: "Error al crear el detalle del producto" });
  }
};

// 🔵 Listar todos los detalles (general)
const getAllDetails = async (req, res) => {
  try {
    const detalles = await prisma.detalle_productos.findMany({
      include: {
        productos: {
          select: { nombre: true },
        },
      },
      orderBy: { id_detalle_producto: "desc" },
      where: {
        estado: true,
      },
    });
    res.json(detalles);
  } catch (error) {
    console.error("❌ Error al listar detalles:", error);
    res.status(500).json({ message: "Error al obtener los detalles" });
  }
};

// 🟣 Listar detalles por producto (id_producto)
const getDetailsByProduct = async (req, res) => {
  const { id_producto } = req.params;
  try {
    const detalles = await prisma.detalle_productos.findMany({
      where: {
        AND: [{ id_producto: Number(id_producto) }, { estado: true }],
      },
      orderBy: { id_detalle_producto: "desc" },
    });

    if (!detalles.length)
      return res
        .status(404)
        .json({ message: "No hay detalles para este producto" });

    res.json(detalles);
  } catch (error) {
    console.error("❌ Error al obtener detalles del producto:", error);
    res
      .status(500)
      .json({ message: "Error al obtener detalles del producto" });
  }
};

// 🟠 Obtener un detalle individual (por id_detalle_producto)
const getDetailById = async (req, res) => {
  const { id_detalle_producto } = req.params;
  try {
    const detalle = await prisma.detalle_productos.findUnique({
      where: { id_detalle_producto: Number(id_detalle_producto) },
      include: {
        productos: {
          select: { nombre: true },
        },
      },
    });

    if (!detalle)
      return res.status(404).json({ message: "Detalle no encontrado" });

    res.json(detalle);
  } catch (error) {
    console.error("❌ Error al obtener detalle individual:", error);
    res.status(500).json({ message: "Error al obtener detalle individual" });
  }
};

// 🟡 Actualizar un detalle
const updateDetailProduct = async (req, res) => {
  const { id_detalle_producto } = req.params;
  const data = req.body;
  try {
    const updated = await prisma.detalle_productos.update({
      where: { id_detalle_producto: Number(id_detalle_producto) },
      data: {
        codigo_barras_producto_compra: data.codigo_barras,
        fecha_vencimiento: data.fecha_vencimiento
          ? new Date(data.fecha_vencimiento)
          : null,
        stock_producto: data.stock_producto,
        es_devolucion: data.es_devolucion ?? false,
        estado: true,
      },
    });
    res.json(updated);
  } catch (error) {
    console.error("❌ Error al actualizar detalle:", error);
    res.status(500).json({ message: "Error al actualizar detalle" });
  }
};

// 🔴 Eliminar detalle (borrado lógico con mensajes claros)
const deleteDetailProduct = async (req, res) => {
  const { id_detalle_producto } = req.params;

  try {
    const existing = await prisma.detalle_productos.findUnique({
      where: { id_detalle_producto: Number(id_detalle_producto) },
    });

    if (!existing) {
      return res
        .status(404)
        .json({ message: "El detalle del producto no existe." });
    }

    if (existing.estado === false) {
      return res
        .status(400)
        .json({ message: "El detalle ya estaba eliminado." });
    }

    const deleted = await prisma.detalle_productos.update({
      where: { id_detalle_producto: Number(id_detalle_producto) },
      data: {
        estado: false,
      },
    });

    return res.json({
      message: "Detalle eliminado correctamente",
      deleted,
    });
  } catch (error) {
    console.error("❌ Error al eliminar detalle:", error);
    res.status(500).json({ message: "Error al eliminar detalle" });
  }
};

module.exports = {
  createDetailProduct,
  getAllDetails,
  getDetailsByProduct,
  getDetailById,
  updateDetailProduct,
  deleteDetailProduct,
};
