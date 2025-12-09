const prisma = require("../prisma/prismaClient");

// ======================
// Utils
// ======================
const isValidDateYYYYMMDD = (s) =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

const toIntOrNull = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const normalizeProducts = (productos) => {
  if (!Array.isArray(productos) || productos.length === 0) {
    const e = new Error("productos debe tener al menos 1 item");
    e.status = 400;
    throw e;
  }

  return productos.map((p, idx) => {
    const nombre = String(p.nombre ?? "").trim(); // UX (no se persiste)
    const cantidad = Number(p.cantidad);
    const precioUnitario = Number(p.precioUnitario);
    const productoId = p.productoId ?? null;

    if (!nombre) {
      const e = new Error(`Producto[${idx}]: nombre requerido`);
      e.status = 400;
      throw e;
    }
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      const e = new Error(`Producto[${idx}]: cantidad inválida`);
      e.status = 400;
      throw e;
    }
    if (!Number.isFinite(precioUnitario) || precioUnitario < 0) {
      const e = new Error(`Producto[${idx}]: precioUnitario inválido`);
      e.status = 400;
      throw e;
    }

    return {
      productoId,
      nombre,
      cantidad,
      precioUnitario,
      subtotal: cantidad * precioUnitario,
    };
  });
};

// ======================
// GET /sales
// ======================
exports.getSales = async (_req, res) => {
  try {
    const sales = await prisma.ventas.findMany({
      orderBy: { id_venta: "desc" },
      include: {
        clientes: true,
        detalle_venta: {
          include: {
            // ✅ trae el producto real para poder mostrar el nombre en el modal
            detalle_productos: {
              include: {
                productos: true,
              },
            },
          },
        },
      },
    });

    res.json(sales);
  } catch (error) {
    console.error("❌ getSales:", error);
    res.status(500).json({ message: "Error listando ventas" });
  }
};

// ======================
// POST /sales
// Body esperado:
// { fecha:"YYYY-MM-DD", clienteId?, medioPago, estado, productos:[...] }
// ======================
exports.createSale = async (req, res) => {
  try {
    const { fecha, clienteId, medioPago, estado, productos } = req.body;

    // Validaciones
    if (!isValidDateYYYYMMDD(fecha)) {
      return res.status(400).json({ message: "fecha inválida (YYYY-MM-DD)" });
    }
    if (!medioPago) {
      return res.status(400).json({ message: "medioPago requerido" });
    }
    if (!estado) {
      return res.status(400).json({ message: "estado requerido" });
    }

    const items = normalizeProducts(productos);
    const total = items.reduce((acc, it) => acc + it.subtotal, 0);

    // ✅ Mapeo EXACTO a tu tabla ventas
    const dataVenta = {
      fecha_venta: new Date(`${fecha}T00:00:00.000Z`),
      metodo_pago: String(medioPago),
      estado_venta: String(estado),
      total,
      id_cliente: toIntOrNull(clienteId),
    };

    const created = await prisma.ventas.create({
      data: {
        ...dataVenta,
        detalle_venta: {
          create: items.map((it) => ({
            // ✅ guarda FK real
            id_detalle_producto: toIntOrNull(it.productoId),
            cantidad: it.cantidad,
            precio_unitario: it.precioUnitario,
            subtotal: it.subtotal,
          })),
        },
      },
      include: {
        clientes: true,
        detalle_venta: {
          include: {
            // ✅ igual que en GET
            detalle_productos: {
              include: {
                productos: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json(created);
  } catch (error) {
    console.error("❌ createSale:", error);
    res
      .status(error.status || 500)
      .json({ message: error.message || "Error creando venta" });
  }
};
// PATCH /sales/:id/status
// ======================
// PUT /sales/:id  -> actualizar estado
// Body: { estado: "Cancelada" }
// ======================
exports.updateSaleStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { estado } = req.body;

    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "id inválido" });
    }
    if (!estado) {
      return res.status(400).json({ message: "estado requerido" });
    }

    const updated = await prisma.ventas.update({
      where: { id_venta: id },
      data: { estado_venta: String(estado) },
      include: {
        clientes: true,
        detalle_venta: {
          include: {
            detalle_productos: {
              include: { productos: true },
            },
          },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error("❌ updateSaleStatus:", error);
    res.status(500).json({ message: "Error actualizando estado de venta" });
  }
};
