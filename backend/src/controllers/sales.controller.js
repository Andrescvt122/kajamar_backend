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

    // OJO: productoId = ID DEL LOTE (detalle_productos.id_detalle_producto)
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

const diffMinutesBetween = (a, b) => {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / 60000);
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
            detalle_productos: {
              include: { productos: true },
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
// Body:
// { fecha:"YYYY-MM-DD", clienteId?, medioPago, estado, productos:[...] }
// productos[].productoId = id_detalle_producto (lote)
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

    // Todos deben traer lote
    const missingLot = items.find((it) => !toIntOrNull(it.productoId));
    if (missingLot) {
      return res.status(400).json({
        message:
          "Cada item debe enviar productoId (id_detalle_producto del lote) para descontar stock.",
      });
    }

    // 1) Validar stock con pre-lectura (mensaje bonito de insuficiente)
    const loteIds = [...new Set(items.map((it) => Number(it.productoId)))];

    const lotes = await prisma.detalle_productos.findMany({
      where: { id_detalle_producto: { in: loteIds } },
      include: { productos: true },
    });

    const loteById = new Map(lotes.map((l) => [l.id_detalle_producto, l]));

    for (const it of items) {
      const loteId = Number(it.productoId);
      const lote = loteById.get(loteId);

      if (!lote) {
        return res.status(400).json({
          message: `Lote no existe: id_detalle_producto=${loteId}`,
        });
      }

      const disponible = Number(lote.stock_producto ?? 0);
      if (disponible < it.cantidad) {
        return res.status(400).json({
          code: "STOCK_INSUFICIENTE",
          message: `Stock insuficiente. Lote ${loteId}: disponible ${disponible}, solicitado ${it.cantidad}`,
          loteId,
          disponible,
          solicitado: it.cantidad,
        });
      }
    }

    const total = items.reduce((acc, it) => acc + it.subtotal, 0);

    const dataVenta = {
      fecha_venta: new Date(), // ✅ hora real de creación
      metodo_pago: String(medioPago),
      estado_venta: String(estado),
      total,
      id_cliente: toIntOrNull(clienteId),
    };

    // 2) Transacción ATÓMICA (interactiva, pero rápida: SOLO updates + create)
    const created = await prisma.$transaction(
      async (tx) => {
        // Agrupar por lote (si repiten lote, suma cantidades)
        const qtyByLote = new Map();
        for (const it of items) {
          const loteId = Number(it.productoId);
          qtyByLote.set(
            loteId,
            (qtyByLote.get(loteId) || 0) + Number(it.cantidad)
          );
        }

        // Descontar stock por lote con condición stock >= qty
        for (const [loteId, qty] of qtyByLote.entries()) {
          const r = await tx.detalle_productos.updateMany({
            where: {
              id_detalle_producto: loteId,
              stock_producto: { gte: qty },
            },
            data: { stock_producto: { decrement: qty } },
          });

          if ((r?.count ?? 0) === 0) {
            const e = new Error(
              `Stock insuficiente (cambió durante el registro). Lote ${loteId}`
            );
            e.status = 400;
            e.code = "STOCK_INSUFICIENTE";
            throw e;
          }
        }

        // Crear venta + detalle
        return tx.ventas.create({
          data: {
            ...dataVenta,
            detalle_venta: {
              create: items.map((it) => ({
                id_detalle_producto: Number(it.productoId),
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
                detalle_productos: { include: { productos: true } },
              },
            },
          },
        });
      },
      { timeout: 15000 } // ⬅️ evita el error de 5000ms si tu PC está lenta
    );

    return res.status(201).json(created);
  } catch (error) {
    console.error("❌ createSale:", error);
    return res.status(error.status || 500).json({
      code: error.code,
      message: error.message || "Error creando venta",
    });
  }
};

// ======================
// PUT /sales/:id/status
// Body: { estado: "Anulada" }
// - Solo permite anular en 30 min
// - Si pasa a "Anulada" => devuelve stock
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

    const nuevoEstado = String(estado);

    const sale = await prisma.ventas.findUnique({
      where: { id_venta: id },
      include: {
        clientes: true,
        detalle_venta: true, // solo para devolver stock
      },
    });

    if (!sale) return res.status(404).json({ message: "Venta no encontrada" });

    const estadoActual = String(sale.estado_venta || "");

    // Si ya está anulada y la vuelven a anular => devuelvo la venta completa (no doble stock)
    if (estadoActual === "Anulada" && nuevoEstado === "Anulada") {
      const same = await prisma.ventas.findUnique({
        where: { id_venta: id },
        include: {
          clientes: true,
          detalle_venta: {
            include: { detalle_productos: { include: { productos: true } } },
          },
        },
      });
      return res.json(same);
    }

    // ✅ Regla: solo anular dentro de 30 min
    if (nuevoEstado === "Anulada") {
      const LIMIT_MINUTES = 30;
      const fechaVenta = sale.fecha_venta ? new Date(sale.fecha_venta) : null;

      if (!fechaVenta || Number.isNaN(fechaVenta.getTime())) {
        return res.status(400).json({
          code: "VENTA_SIN_FECHA",
          message: "La venta no tiene fecha válida para anular.",
        });
      }

      const now = new Date();
      const diffMinutes = diffMinutesBetween(fechaVenta, now);

      if (diffMinutes > LIMIT_MINUTES) {
        return res.status(400).json({
          code: "ANULAR_TIEMPO_EXCEDIDO",
          message: `No se puede anular: han pasado ${diffMinutes} minutos desde la venta (límite ${LIMIT_MINUTES}).`,
          diffMinutes,
          limitMinutes: LIMIT_MINUTES,
        });
      }

      // ✅ Anular y devolver stock
      await prisma.$transaction(async (tx) => {
        // agrupar por lote
        const qtyByLote = new Map();
        for (const d of sale.detalle_venta || []) {
          const loteId = Number(d.id_detalle_producto);
          if (!Number.isFinite(loteId)) continue;

          qtyByLote.set(
            loteId,
            (qtyByLote.get(loteId) || 0) + Number(d.cantidad || 0)
          );
        }

        // sumar stock a cada lote
        for (const [loteId, qty] of qtyByLote.entries()) {
          if (qty > 0) {
            await tx.detalle_productos.update({
              where: { id_detalle_producto: loteId },
              data: { stock_producto: { increment: qty } },
            });
          }
        }

        // actualizar estado
        await tx.ventas.update({
          where: { id_venta: id },
          data: { estado_venta: "Anulada" },
        });
      });

      const updated = await prisma.ventas.findUnique({
        where: { id_venta: id },
        include: {
          clientes: true,
          detalle_venta: {
            include: { detalle_productos: { include: { productos: true } } },
          },
        },
      });

      return res.json(updated);
    }

    // ✅ Si NO es anulada => solo cambiar estado
    const updated = await prisma.ventas.update({
      where: { id_venta: id },
      data: { estado_venta: nuevoEstado },
      include: {
        clientes: true,
        detalle_venta: {
          include: { detalle_productos: { include: { productos: true } } },
        },
      },
    });

    return res.json(updated);
  } catch (error) {
    console.error("❌ updateSaleStatus:", error);
    return res.status(error.status || 500).json({
      code: error.code,
      message: error.message || "Error actualizando estado de venta",
    });
  }
};
