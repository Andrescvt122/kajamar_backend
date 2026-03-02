const prisma = require("../prisma/prismaClient");

/** Helpers */
function toDecimalOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toDecimalOrUndefined(v) {
  if (v === undefined) return undefined; // no tocar si no viene
  if (v === null || v === "") return null; // permitir setear null explícito
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toInt(v, def = 0) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? n : def;
}

/** ============================
 * 🟢 Crear detalle de producto
 * ============================ */
const createDetailProduct = async (req, res) => {
  const data = req.body;

  try {
    if (!data?.id_producto) {
      return res.status(400).json({ message: "Falta id_producto" });
    }
    if (!data?.codigo_barras) {
      return res.status(400).json({ message: "Falta codigo_barras" });
    }

    const stock = toInt(data.stock_producto, 0);
    if (stock < 0) {
      return res.status(400).json({ message: "stock_producto inválido" });
    }

    const register = await prisma.$transaction(async (tx) => {
      const detailProduct = await tx.detalle_productos.create({
        data: {
          id_producto: Number(data.id_producto),
          codigo_barras_producto_compra: String(data.codigo_barras).trim(),
          fecha_vencimiento: data.fecha_vencimiento
            ? new Date(data.fecha_vencimiento)
            : null,
          stock_producto: stock,
          es_devolucion: data.es_devolucion ?? false,
          estado: true,
          lote: data.lote ? String(data.lote).trim() : null,

          // ✅ NUEVO: impuestos y precio venta por detalle (lote)
          iva_porcentaje: toDecimalOrNull(data.iva_porcentaje),
          icu_porcentaje: toDecimalOrNull(data.icu_porcentaje),
          precio_venta: toDecimalOrNull(data.precio_venta),
        },
      });

      // ✅ Actualiza el stock total del producto
      await tx.productos.update({
        where: { id_producto: Number(data.id_producto) },
        data: { stock_actual: { increment: stock } },
      });

      return detailProduct;
    });

    return res.status(201).json(register);
  } catch (error) {
    console.error("❌ Error al crear el detalle del producto:", error);
    return res.status(500).json({
      message: "Error al crear el detalle del producto",
      error: error.message,
    });
  }
};

/** ============================
 * 🔵 Listar todos los detalles
 * ============================ */
const getAllDetails = async (req, res) => {
  try {
    const detalles = await prisma.detalle_productos.findMany({
      where: { estado: true },
      orderBy: { id_detalle_producto: "desc" },
     select: {
     id_detalle_producto: true,
     id_producto: true,
     codigo_barras_producto_compra: true,
     fecha_vencimiento: true,
     stock_producto: true,
     es_devolucion: true,
     estado: true,
     lote: true,
     // ✅ DEVOLVER ESTOS CAMPOS SIEMPRE
     iva_porcentaje: true,
     icu_porcentaje: true,
     precio_venta: true,
    // 
     costo_unitario: true,
     incremento_venta: true,

    productos: { select: { nombre: true, precio_venta: true } }, // opcional
    },
    });

    res.json(detalles);
  } catch (error) {
    console.error("❌ Error al listar detalles:", error);
    res.status(500).json({ message: "Error al obtener los detalles" });
  }
};

/** ============================
 * 🟣 Listar detalles por producto
 * ============================ */
const getDetailsByProduct = async (req, res) => {
  try {
    const id_producto = Number(req.params.id_producto);

    if (!Number.isFinite(id_producto) || id_producto <= 0) {
      return res.status(400).json({ message: "id_producto inválido" });
    }

    const detalles = await prisma.detalle_productos.findMany({
      where: {
        id_producto: id_producto,
        OR: [{ estado: true }, { estado: null }],
      },
      orderBy: { id_detalle_producto: "desc" },
      select: {
        id_detalle_producto: true,
        id_producto: true,
        codigo_barras_producto_compra: true,
        fecha_vencimiento: true,
        stock_producto: true,
        es_devolucion: true,
        estado: true,

        iva_porcentaje: true,
        icu_porcentaje: true,
        precio_venta: true,
        costo_unitario: true,
        incremento_venta: true,

        productos: {
          select: {
            nombre: true,
            precio_venta: true,
          },
        },
      },
    });

    // ✅ SI NO HAY DETALLES → DEVOLVER ARRAY VACÍO (NO ERROR)
    return res.json(detalles ?? []);
  } catch (error) {
    console.error("❌ getDetailsByProduct:", error);
    return res.status(500).json({
      message: "Error al obtener detalles del producto",
      error: error.message,
    });
  }
};
/** ============================
 * 🟠 Obtener un detalle individual
 * ============================ */
const getDetailById = async (req, res) => {
  const { id_detalle_producto } = req.params;

  try {
    const detalle = await prisma.detalle_productos.findUnique({
      where: { id_detalle_producto: Number(id_detalle_producto) },
      select: {
        id_detalle_producto: true,
        id_producto: true,
        codigo_barras_producto_compra: true,
        fecha_vencimiento: true,
        stock_producto: true,
        es_devolucion: true,
        estado: true,
        lote: true,

        // ✅ DEVOLVER ESTOS CAMPOS SIEMPRE
        iva_porcentaje: true,
        icu_porcentaje: true,
        precio_venta: true,

        productos: { select: { nombre: true, precio_venta: true } },
      },
    });

    if (!detalle) return res.status(404).json({ message: "Detalle no encontrado" });
    res.json(detalle);
  } catch (error) {
    console.error("❌ Error al obtener detalle individual:", error);
    res.status(500).json({ message: "Error al obtener detalle individual" });
  }
};

/** ============================
 * 🟡 Actualizar un detalle
 * ============================ */
const updateDetailProduct = async (req, res) => {
  const { id_detalle_producto } = req.params;
  const data = req.body;

  try {
    const updated = await prisma.detalle_productos.update({
      where: { id_detalle_producto: Number(id_detalle_producto) },
      data: {
        codigo_barras_producto_compra: data.codigo_barras
          ? String(data.codigo_barras).trim()
          : undefined,

        fecha_vencimiento:
          data.fecha_vencimiento === undefined
            ? undefined
            : data.fecha_vencimiento
            ? new Date(data.fecha_vencimiento)
            : null,

        stock_producto: data.stock_producto === undefined ? undefined : toInt(data.stock_producto, 0),
        es_devolucion: data.es_devolucion ?? false,
        estado: true,

        lote: data.lote === undefined ? undefined : data.lote ? String(data.lote).trim() : null,

        // ✅ NUEVO: actualizar impuestos y precio venta
        iva_porcentaje: toDecimalOrUndefined(data.iva_porcentaje),
        icu_porcentaje: toDecimalOrUndefined(data.icu_porcentaje),
        precio_venta: toDecimalOrUndefined(data.precio_venta),
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("❌ Error al actualizar detalle:", error);
    res.status(500).json({ message: "Error al actualizar detalle", error: error.message });
  }
};

/** ============================
 * 🔴 Eliminar detalle (soft delete)
 * ============================ */
const deleteDetailProduct = async (req, res) => {
  const { id_detalle_producto } = req.params;

  try {
    const detail = await prisma.detalle_productos.findUnique({
      where: { id_detalle_producto: Number(id_detalle_producto) },
      include: {
        detalle_venta: true,
        detalle_compra: true,
        devolucion_cliente_entregado: true,
        detalle_devolucion_producto: true,
        detalle_productos_baja: true,
      },
    });

    if (!detail) return res.status(404).json({ message: "Detalle no encontrado" });

    if (detail.estado === false) {
      return res.status(409).json({ message: "Este detalle ya está eliminado." });
    }

    const counts = {
      ventas: detail.detalle_venta?.length ?? 0,
      compras: detail.detalle_compra?.length ?? 0,
      devolucion_cliente: detail.devolucion_cliente_entregado?.length ?? 0,
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
        details: counts,
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

/** ============================
 * 🔴 Eliminar definitivo (hard delete) por query ?q=
 * ============================ */
const deleteOneDetailProduct = async (req, res) => {
  let { q } = req.query;
  const id = Number(q);

  try {
    const detail = await prisma.detalle_productos.findUnique({
      where: { id_detalle_producto: id },
      include: {
        detalle_venta: true,
        detalle_compra: true,
        devolucion_cliente_entregado: true,
        detalle_devolucion_producto: true,
        detalle_productos_baja: true,
      },
    });

    if (!detail) return res.status(404).json({ message: "Detalle no encontrado" });

    const counts = {
      ventas: detail.detalle_venta?.length ?? 0,
      compras: detail.detalle_compra?.length ?? 0,
      devolucion_cliente: detail.devolucion_cliente_entregado?.length ?? 0,
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