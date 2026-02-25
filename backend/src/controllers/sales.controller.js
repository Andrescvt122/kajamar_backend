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

    // OJO: productoId = ID DEL DETALLE (detalle_productos.id_detalle_producto)
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
// { fecha:"YYYY-MM-DD", clienteId?, medioPago, estado, productos:[...], pagoMixto? }
// pagoMixto: { efectivo, transferencia } (solo si medioPago="Mixto")
// productos[].productoId = id_detalle_producto (detalle)
// ======================
exports.createSale = async (req, res) => {
  try {
    const { fecha, clienteId, medioPago, estado, productos, pagoMixto } =
      req.body;

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

    // Todos deben traer detalle
    const missingDetail = items.find((it) => !toIntOrNull(it.productoId));
    if (missingDetail) {
      return res.status(400).json({
        message:
          "Cada item debe enviar productoId (id_detalle_producto) para descontar stock.",
      });
    }

    // 1) Validar stock con pre-lectura (mensaje bonito de insuficiente)
    const detalleIds = [...new Set(items.map((it) => Number(it.productoId)))];

    const detalles = await prisma.detalle_productos.findMany({
      where: { id_detalle_producto: { in: detalleIds } },
      include: { productos: true },
    });

    const detalleById = new Map(detalles.map((d) => [d.id_detalle_producto, d]));

    for (const it of items) {
      const detalleId = Number(it.productoId);
      const detalle = detalleById.get(detalleId);

      if (!detalle) {
        return res.status(400).json({
          message: `Detalle no existe: id_detalle_producto=${detalleId}`,
        });
      }

      const disponible = Number(detalle.stock_producto ?? 0);
      if (disponible < it.cantidad) {
        return res.status(400).json({
          code: "STOCK_INSUFICIENTE",
          message: `Stock insuficiente. Detalle ${detalleId}: disponible ${disponible}, solicitado ${it.cantidad}`,
          detalleId,
          disponible,
          solicitado: it.cantidad,
        });
      }
    }

    const total = items.reduce((acc, it) => acc + it.subtotal, 0);

    // =====================================================
    // ✅ NUEVO: normalizar montos por método de pago
    // =====================================================
    const metodo = String(medioPago); // "Efectivo" | "Transferencia" | "Mixto"

    let monto_efectivo = 0;
    let monto_transferencia = 0;

    if (metodo === "Mixto") {
      const ef = Number(pagoMixto?.efectivo ?? 0);
      const tr = Number(pagoMixto?.transferencia ?? 0);

      if (!Number.isFinite(ef) || !Number.isFinite(tr)) {
        return res.status(400).json({
          message: "pagoMixto inválido: efectivo/transferencia deben ser números",
        });
      }

      if (ef <= 0 || tr <= 0) {
        return res.status(400).json({
          message: "En pago Mixto debes enviar efectivo y transferencia > 0.",
        });
      }

      if (ef + tr !== total) {
        return res.status(400).json({
          message: `Pago mixto no cuadra: efectivo(${ef}) + transferencia(${tr}) != total(${total})`,
        });
      }

      monto_efectivo = ef;
      monto_transferencia = tr;
    } else if (metodo === "Efectivo") {
      monto_efectivo = total;
      monto_transferencia = 0;
    } else if (metodo === "Transferencia") {
      monto_transferencia = total;
      monto_efectivo = 0;
    } else {
      // Por si mandan algo raro
      return res.status(400).json({
        message: "medioPago inválido. Usa: Efectivo | Transferencia | Mixto",
      });
    }

    const dataVenta = {
      fecha_venta: new Date(), // ✅ hora real de creación
      metodo_pago: metodo,
      estado_venta: String(estado),
      total,
      id_cliente: toIntOrNull(clienteId),

      // ✅ IMPORTANTÍSIMO para el CHECK
      monto_efectivo,
      monto_transferencia,
    };

    // 2) Transacción ATÓMICA (interactiva, pero rápida: SOLO updates + create)
    const created = await prisma.$transaction(
      async (tx) => {
        // Agrupar por detalle (si repiten detalle, suma cantidades)
        const qtyByDetalle = new Map();
        for (const it of items) {
          const detalleId = Number(it.productoId);
          qtyByDetalle.set(
            detalleId,
            (qtyByDetalle.get(detalleId) || 0) + Number(it.cantidad)
          );
        }

        // Descontar stock por detalle con condición stock >= qty
        for (const [detalleId, qty] of qtyByDetalle.entries()) {
          const r = await tx.detalle_productos.updateMany({
            where: {
              id_detalle_producto: detalleId,
              stock_producto: { gte: qty },
            },
            data: { stock_producto: { decrement: qty } },
          });

          if ((r?.count ?? 0) === 0) {
            const e = new Error(
              `Stock insuficiente (cambió durante el registro). Detalle ${detalleId}`
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
// (sin cambios)
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

      await prisma.$transaction(async (tx) => {
        const qtyByDetalle = new Map();
        for (const d of sale.detalle_venta || []) {
          const detalleId = Number(d.id_detalle_producto);
          if (!Number.isFinite(detalleId)) continue;

          qtyByDetalle.set(
            detalleId,
            (qtyByDetalle.get(detalleId) || 0) + Number(d.cantidad || 0)
          );
        }

        for (const [detalleId, qty] of qtyByDetalle.entries()) {
          if (qty > 0) {
            await tx.detalle_productos.update({
              where: { id_detalle_producto: detalleId },
              data: { stock_producto: { increment: qty } },
            });
          }
        }

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

