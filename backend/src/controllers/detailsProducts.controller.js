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

    // ✅ Mejor UX: si no hay detalles, devolvemos array vacío (200)
    return res.json(detalles || []);
  } catch (error) {
    console.error("❌ Error al obtener detalles del producto:", error);
    res.status(500).json({ message: "Error al obtener detalles del producto" });
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

// 🔴 Eliminar detalle (soft delete) con motivo específico
// 🔴 Eliminar detalle (soft delete) -> si tiene relaciones, NO deja y explica
const deleteDetailProduct = async (req, res) => {
  const { id_detalle_producto } = req.params;

  try {
    const detail = await prisma.detalle_productos.findUnique({
      where: { id_detalle_producto: Number(id_detalle_producto) },
      include: {
        detalle_venta: true,
        detalle_compra: true,
        detalle_devolucion_cliente: true,
        detalle_devolucion_producto: true,
        detalle_productos_baja: true,
      },
    });

    if (!detail) {
      return res.status(404).json({ message: "Detalle no encontrado" });
    }

    if (detail.estado === false) {
      return res.status(409).json({ message: "Este detalle ya está eliminado." });
    }

    const counts = {
      ventas: detail.detalle_venta?.length ?? 0,
      compras: detail.detalle_compra?.length ?? 0,
      devolucion_cliente: detail.detalle_devolucion_cliente?.length ?? 0,
      devolucion_producto: detail.detalle_devolucion_producto?.length ?? 0,
      bajas: detail.detalle_productos_baja?.length ?? 0,
    };

    const reasons = [];
    if (counts.ventas > 0) reasons.push(`ventas (${counts.ventas})`);
    if (counts.compras > 0) reasons.push(`compras (${counts.compras})`);
    if (counts.devolucion_cliente > 0)
      reasons.push(`devoluciones de cliente (${counts.devolucion_cliente})`);
    if (counts.devolucion_producto > 0)
      reasons.push(`devoluciones de producto (${counts.devolucion_producto})`);
    if (counts.bajas > 0) reasons.push(`bajas (${counts.bajas})`);

    if (reasons.length > 0) {
      return res.status(409).json({
        message: `No se puede eliminar: este detalle está asociado a ${reasons.join(", ")}.`,
        details: counts, // opcional para UI/logs
      });
    }

    const deleted = await prisma.detalle_productos.update({
      where: { id_detalle_producto: Number(id_detalle_producto) },
      data: { estado: false },
    });

    return res.json({ message: "Detalle eliminado correctamente", deleted });
  } catch (error) {
    console.error("❌ Error al eliminar detalle:", error);
    return res.status(500).json({ message: "Error al eliminar detalle" });
  }
};

// 🔴 Eliminar definitivo (hard delete) por query ?q=
// 🔴 Eliminar definitivo (hard delete) -> si tiene relaciones, NO deja y explica
const deleteOneDetailProduct = async (req, res) => {
  let { q } = req.query;
  const id = Number(q);

  try {
    const detail = await prisma.detalle_productos.findUnique({
      where: { id_detalle_producto: id },
      include: {
        detalle_venta: true,
        detalle_compra: true,
        detalle_devolucion_cliente: true,
        detalle_devolucion_producto: true,
        detalle_productos_baja: true,
      },
    });

    if (!detail) {
      return res.status(404).json({ message: "Detalle no encontrado" });
    }

    const counts = {
      ventas: detail.detalle_venta?.length ?? 0,
      compras: detail.detalle_compra?.length ?? 0,
      devolucion_cliente: detail.detalle_devolucion_cliente?.length ?? 0,
      devolucion_producto: detail.detalle_devolucion_producto?.length ?? 0,
      bajas: detail.detalle_productos_baja?.length ?? 0,
    };

    const reasons = [];
    if (counts.ventas > 0) reasons.push(`ventas (${counts.ventas})`);
    if (counts.compras > 0) reasons.push(`compras (${counts.compras})`);
    if (counts.devolucion_cliente > 0)
      reasons.push(`devoluciones de cliente (${counts.devolucion_cliente})`);
    if (counts.devolucion_producto > 0)
      reasons.push(`devoluciones de producto (${counts.devolucion_producto})`);
    if (counts.bajas > 0) reasons.push(`bajas (${counts.bajas})`);

    if (reasons.length > 0) {
      return res.status(409).json({
        message: `No se puede eliminar definitivamente: este detalle está asociado a ${reasons.join(", ")}.`,
        details: counts,
      });
    }

    const deleted = await prisma.detalle_productos.delete({
      where: { id_detalle_producto: id },
    });

    return res.json({ message: "Detalle eliminado correctamente", deleted });
  } catch (error) {
    console.error("❌ Error al eliminar detalle:", error);
    return res.status(500).json({ message: "Error al eliminar detalle" });
  }
};


module.exports = {
  createDetailProduct,
  getAllDetails,
  getDetailsByProduct,
  getDetailById,
  updateDetailProduct,
  deleteDetailProduct,
  deleteOneDetailProduct,
};