// src/controllers/purchase.controller.js
const { PrismaClient } = require("@prisma/client");
const {
  safeUnlink,
  uploadImageFileToCloudinary,
} = require("../utils/cloudinaryUpload");
const prisma = new PrismaClient();

/** ===================== Helpers ===================== */
function parseFecha(fecha) {
  if (!fecha) return null;

  if (fecha instanceof Date && !isNaN(fecha)) return fecha;

  if (typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}/.test(fecha)) {
    const d = new Date(fecha);
    return isNaN(d) ? null : d;
  }

  if (typeof fecha === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(fecha)) {
    const [dd, mm, yyyy] = fecha.split("/").map(Number);
    const d = new Date(yyyy, mm - 1, dd);
    return isNaN(d) ? null : d;
  }

  const d = new Date(fecha);
  return isNaN(d) ? null : d;
}

function toNumber(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function toDecimalOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toNonNegInt(v, def = 0) {
  const n = Math.floor(toNumber(v, def));
  return Number.isFinite(n) ? Math.max(0, n) : Math.max(0, def);
}

function getPayload(req) {
  if (req.body?.data) {
    try {
      return JSON.parse(req.body.data);
    } catch {
      throw new Error("El campo 'data' no es JSON válido");
    }
  }
  return req.body || {};
}

async function getComprobante(req, payload) {
  if (req.file) {
    const uploadResult = await uploadImageFileToCloudinary(req.file.path, {
      folder: "kajamart/purchases",
    });

    return {
      url: uploadResult?.secure_url ?? null,
      nombre: req.file.originalname,
      mime: req.file.mimetype,
      size: req.file.size,
    };
  }

  const c = payload?.comprobante;
  if (c && typeof c === "object") {
    return {
      url: c.url ?? null,
      nombre: c.nombre ?? null,
      mime: c.mime ?? null,
      size: c.size != null ? Number(c.size) : null,
    };
  }
  return null;
}

function normalizeInvoiceNumber(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function isInvoiceUniqueConstraintError(error) {
  if (error?.code !== "P2002") return false;

  const target = error?.meta?.target;
  if (Array.isArray(target)) return target.includes("numero_factura");

  return String(target || "").includes("numero_factura");
}

exports.validatePurchaseInvoiceNumber = async (req, res) => {
  try {
    const numeroFactura = normalizeInvoiceNumber(req.query.numero_factura);

    if (!numeroFactura) {
      return res.status(400).json({
        message: "El numero de factura es obligatorio",
      });
    }

    const purchase = await prisma.compras.findFirst({
      where: { numero_factura: numeroFactura },
      select: { id_compra: true },
    });

    return res.status(200).json({
      numero_factura: numeroFactura,
      exists: Boolean(purchase),
      isUnique: !purchase,
    });
  } catch (error) {
    console.error("❌ validatePurchaseInvoiceNumber:", error);
    return res.status(500).json({
      message: "Error al validar el numero de factura",
    });
  }
};

/** ===================== CREATE PURCHASE ===================== */
exports.createPurchase = async (req, res) => {
  try {
    const payload = getPayload(req);
    const { fecha_compra, id_proveedor, items, numero_factura } = payload;
    const numeroFactura = normalizeInvoiceNumber(numero_factura);

    if (!id_proveedor || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Datos incompletos (proveedor/items)" });
    }

    if (!numeroFactura) {
      return res.status(400).json({ message: "El numero de factura es obligatorio" });
    }

    const fechaCompraDate = new Date(); 
    const purchaseWithSameInvoice = await prisma.compras.findFirst({
      where: { numero_factura: numeroFactura },
      select: { id_compra: true },
    });

    if (purchaseWithSameInvoice) {
      return res.status(409).json({
        message: "El numero de factura ya existe",
      });
    }

    const comprobante = await getComprobante(req, payload);

    const compraCreada = await prisma.$transaction(async (tx) => {
      let subtotal = 0;
      let totalImpuestos = 0;

      /** ===== VALIDACIÓN Y TOTALES ===== */
      for (const item of items) {
        const idProducto = Number(item.id_producto);
        if (!idProducto) throw new Error("Item inválido: falta id_producto");

        const productoExiste = await tx.productos.findUnique({
          where: { id_producto: idProducto },
          select: { id_producto: true },
        });
        if (!productoExiste) throw new Error(`Producto no existe: ${idProducto}`);

        const precioUnit = toNumber(item.precio_unitario, 0);
        const ivaPct = toNumber(item.iva_porcentaje, 0);
        const icuPct = toNumber(item.icu_porcentaje, 0);

        const paquetes = Array.isArray(item.paquetes) ? item.paquetes.length : 0;
        const cantidad = paquetes > 0 ? paquetes : toNonNegInt(item.cantidad, 0);

        if (cantidad <= 0) throw new Error("Cantidad inválida");

        const sub = cantidad * precioUnit;
        subtotal += sub;
        totalImpuestos += sub * ((ivaPct + icuPct) / 100);
      }

      const total = subtotal + totalImpuestos;

      /** ===== CREAR COMPRA ===== */
      const compra = await tx.compras.create({
        data: {
          fecha_compra: fechaCompraDate,
          numero_factura: numeroFactura,
          id_proveedor: Number(id_proveedor),
          subtotal,
          total_impuestos: totalImpuestos,
          total,
          estado_compra: "Completada",
          comprobante_url: comprobante?.url || null,
          comprobante_nombre: comprobante?.nombre || null,
          comprobante_mime: comprobante?.mime || null,
          comprobante_size: comprobante?.size ?? null,
        },
      });

      /** ===== ITEMS ===== */
      for (const item of items) {
        const idProducto = Number(item.id_producto);
        const precioUnit = toNumber(item.precio_unitario, 0);
        const precioVenta = toDecimalOrNull(item.precio_venta);

        const ivaPct = toDecimalOrNull(item.iva_porcentaje);
        const icuPct = toDecimalOrNull(item.icu_porcentaje);

        const unidadesPorPaquete = toNonNegInt(item.unidades_por_paquete, 0);

        let paquetes = Array.isArray(item.paquetes) ? [...item.paquetes] : [];
        if (paquetes.length === 0) {
          paquetes = [
            {
              codigoBarrasIngreso: item.codigo_barras_producto_compra,
              fechaVencimiento: item.fecha_vencimiento,
            },
          ];
        }

        const cantidadPaquetes = paquetes.length;
        const totalUnidades = cantidadPaquetes * unidadesPorPaquete;

        /** ===== COSTO UNITARIO ===== */
        const costoTotal = cantidadPaquetes * precioUnit;
        const costoUnitarioCalc =
          totalUnidades > 0 ? costoTotal / totalUnidades : null;

        /** ===== PRECIO ANTERIOR ===== */
        const prodPrev = await tx.productos.findUnique({
          where: { id_producto: idProducto },
          select: { precio_venta: true },
        });

        const precioAnterior = prodPrev?.precio_venta ?? null;

        /** ===== INCREMENTO CORRECTO ===== */
        let incrementoVentaCalc = null;
        if (
          precioAnterior != null &&
          Number(precioAnterior) > 0 &&
          precioVenta != null &&
          Number(precioVenta) > 0
        ) {
          incrementoVentaCalc =
            Number(precioVenta) / Number(precioAnterior) - 1;
        }

        /** ===== ACTUALIZAR PRODUCTO BASE ===== */
        const dataProdUpdate = {};
        if (totalUnidades > 0)
          dataProdUpdate.stock_actual = { increment: totalUnidades };

        if (precioVenta != null)
          dataProdUpdate.precio_venta = Math.round(Number(precioVenta));

        if (costoUnitarioCalc != null)
          dataProdUpdate.costo_unitario = Math.round(Number(costoUnitarioCalc));

        if (Object.keys(dataProdUpdate).length > 0) {
          await tx.productos.update({
            where: { id_producto: idProducto },
            data: dataProdUpdate,
          });
        }

        /** ===== DETALLE POR PAQUETE ===== */
        for (const pack of paquetes) {
          const codigo = pack.codigoBarrasIngreso?.trim();
          if (!codigo) throw new Error("Paquete sin código");

          const fechaVenc = parseFecha(pack.fechaVencimiento);

          let detalle = await tx.detalle_productos.findFirst({
            where: {
              id_producto: idProducto,
              codigo_barras_producto_compra: codigo,
            },
          });

          if (!detalle) {
            detalle = await tx.detalle_productos.create({
              data: {
                id_producto: idProducto,
                codigo_barras_producto_compra: codigo,
                fecha_vencimiento: fechaVenc,
                stock_producto: 0,
                estado: true,
                iva_porcentaje: ivaPct,
                icu_porcentaje: icuPct,
                precio_venta: precioVenta,
                costo_unitario: costoUnitarioCalc,
                incremento_venta: incrementoVentaCalc,
              },
            });
          }

          if (unidadesPorPaquete > 0) {
            await tx.detalle_productos.update({
              where: { id_detalle_producto: detalle.id_detalle_producto },
              data: {
                stock_producto: { increment: unidadesPorPaquete },
              },
            });
          }

          await tx.detalle_compra.create({
            data: {
              id_compra: compra.id_compra,
              id_detalle_producto: detalle.id_detalle_producto,
              cantidad: 1,
              cantidad_paquetes: 1,
              unidades_por_paquete: unidadesPorPaquete,
              cantidad_total_unidades: unidadesPorPaquete,
              precio_unitario: precioUnit,
              precio_venta: precioVenta ?? 0,
              subtotal: precioUnit,
              iva_porcentaje: ivaPct,
              icu_porcentaje: icuPct,
            },
          });
        }
      }

      return compra;
    });

    return res.status(201).json({
      message: "Compra registrada correctamente",
      compra: compraCreada,
    });
  } catch (error) {
    console.error("❌ createPurchase:", error);

    if (isInvoiceUniqueConstraintError(error)) {
      return res.status(409).json({
        message: "El numero de factura ya existe",
        error: error.message,
      });
    }

    return res.status(500).json({
      message: "Error al registrar la compra",
      error: error.message,
    });
  } finally {
    await safeUnlink(req.file?.path);
  }
};

/** ===================== GET PURCHASES ===================== */
/** ===================== GET PURCHASES (PAGINACIÓN) ===================== */
/** ===================== GET PURCHASES (PAGINACIÓN) ===================== */
exports.getPurchases = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const totalPurchases = await prisma.compras.count();

    const compras = await prisma.compras.findMany({
      orderBy: { id_compra: "desc" },
      skip,
      take: limit,
      include: {
        proveedores: {
          select: {
            nombre: true,
            nit: true,
          },
        },
        detalle_compra: {
          include: {
            detalle_productos: {
              include: {
                productos: {
                  select: {
                    id_producto: true,
                    nombre: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const totalPages = Math.ceil(totalPurchases / limit);

    return res.json({
      data: compras,
      pagination: {
        total: totalPurchases,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error("❌ getPurchases:", error);
    return res.status(500).json({
      message: "Error al listar compras",
      error: error.message,
    });
  }
};
  /** ===================== CANCEL PURCHASE ===================== */
exports.cancelPurchase = async (req, res) => {
  try {
    const id_compra = Number(req.params.id_compra);
    const { motivo } = req.body;

    if (!id_compra || !motivo || motivo.trim().length < 5) {
      return res.status(400).json({
        message: "Debe ingresar un motivo válido",
      });
    }

    const compraActualizada = await prisma.$transaction(async (tx) => {
      const compra = await tx.compras.findUnique({
        where: { id_compra },
        include: {
          detalle_compra: {
            include: { detalle_productos: true },
          },
        },
      });

      if (!compra) throw new Error("Compra no encontrada");
      if (compra.estado_compra === "Anulada")
        throw new Error("La compra ya está anulada");

      // revertir stock
      for (const dc of compra.detalle_compra) {
        const dp = dc.detalle_productos;
        if (!dp) continue;

        const unidades =
          dc.cantidad_total_unidades ||
          dc.cantidad_paquetes * dc.unidades_por_paquete ||
          dc.cantidad ||
          0;

        if (unidades <= 0) continue;

        await tx.detalle_productos.update({
          where: { id_detalle_producto: dp.id_detalle_producto },
          data: { stock_producto: { decrement: unidades } },
        });

        await tx.productos.update({
          where: { id_producto: dp.id_producto },
          data: { stock_actual: { decrement: unidades } },
        });
      }

      // marcar anulada
      return await tx.compras.update({
        where: { id_compra },
        data: {
          estado_compra: "Anulada",
          motivo_anulacion: motivo.trim(),
          fecha_anulacion: new Date(),
        },
        include: {
          proveedores: true,
          detalle_compra: {
            include: {
              detalle_productos: true,
            },
          },
        },
      });
    });

    return res.json({
      message: "Compra anulada correctamente",
      compra: compraActualizada,
    });
  } catch (error) {
    console.error("❌ cancelPurchase:", error);
    return res.status(500).json({
      message: error.message || "Error al anular compra",
    });
  }
};
