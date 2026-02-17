// src/controllers/purchase.controller.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/** ===================== Helpers ===================== */
function parseFecha(fecha) {
  if (!fecha) return null;

  if (fecha instanceof Date && !isNaN(fecha)) return fecha;

  // "yyyy-mm-dd" o "yyyy-mm-ddTHH..."
  if (typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}/.test(fecha)) {
    const d = new Date(fecha);
    return isNaN(d) ? null : d;
  }

  // "dd/mm/yyyy"
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

function toNonNegInt(v, def = 0) {
  const n = Math.floor(toNumber(v, def));
  return Number.isFinite(n) ? Math.max(0, n) : Math.max(0, def);
}

// Lee payload desde:
// 1) multipart: req.body.data (string JSON)
// 2) json: req.body (obj)
function getPayload(req) {
  if (req.body?.data) {
    try {
      return JSON.parse(req.body.data);
    } catch (e) {
      throw new Error("El campo 'data' no es JSON válido");
    }
  }
  return req.body || {};
}

function getComprobante(req, payload) {
  if (req.file) {
    const url = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

    return {
      url,
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

/** ===================== Controller ===================== */
exports.createPurchase = async (req, res) => {
  try {
    const payload = getPayload(req);
    const { fecha_compra, id_proveedor, items } = payload;

    if (!id_proveedor || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Datos incompletos (proveedor/items)" });
    }

    const fechaCompraDate = parseFecha(fecha_compra) || new Date();
    const comprobante = getComprobante(req, payload);

    const compraCreada = await prisma.$transaction(async (tx) => {
      /** 1) Validar productos + calcular totales */
      let subtotal = 0;
      let totalImpuestos = 0;

      for (const item of items) {
        const idProducto = Number(item.id_producto);
        if (!idProducto) throw new Error("Item inválido: falta id_producto");

        const productoExiste = await tx.productos.findUnique({
          where: { id_producto: idProducto },
          select: { id_producto: true },
        });
        if (!productoExiste) throw new Error(`Producto no existe: id_producto=${idProducto}`);

        const precioUnit = toNumber(item.precio_unitario, 0);
        const ivaPct = toNumber(item.iva_porcentaje, 0);
        const icuPct = toNumber(item.icu_porcentaje, 0);

        const paquetesArr = Array.isArray(item.paquetes) ? item.paquetes : [];

        // ✅ cantidad paquetes: prioridad a paquetes[].length
        const cantidadPaquetes =
          paquetesArr.length > 0 ? paquetesArr.length : toNonNegInt(item.cantidad, 0);

        if (cantidadPaquetes <= 0) {
          throw new Error("Item inválido: cantidad_paquetes <= 0");
        }

        const sub = cantidadPaquetes * precioUnit;
        subtotal += sub;
        totalImpuestos += sub * ((ivaPct + icuPct) / 100);
      }

      const total = subtotal + totalImpuestos;

      /** 2) Crear compra */
      const compra = await tx.compras.create({
        data: {
          fecha_compra: fechaCompraDate,
          id_proveedor: Number(id_proveedor),

          subtotal,
          total_impuestos: totalImpuestos,
          total,
          estado_compra: "Completada",

          comprobante_url: comprobante?.url || null,
          comprobante_nombre: comprobante?.nombre || null,
          comprobante_mime: comprobante?.mime || null,
          comprobante_size: comprobante?.size != null ? Number(comprobante.size) : null,
        },
      });

      /** 3) Insertar items + detalle_productos por cada paquete */
      for (const item of items) {
        const idProducto = Number(item.id_producto);

        const precioUnit = toNumber(item.precio_unitario, 0);
        const precioVenta = toNumber(item.precio_venta, 0);

        const ivaPct = toNumber(item.iva_porcentaje, 0);
        const icuPct = toNumber(item.icu_porcentaje, 0);

        // ✅ leer unidades por paquete desde TODOS los nombres posibles (front manda snake_case)
        const unidadesPorPaquete = toNonNegInt(
          item.unidades_por_paquete ?? item.unidadesPorPaquete ?? 0,
          0
        );

        const loteTexto = item.lote ? String(item.lote).trim() : null;

        let paquetes = Array.isArray(item.paquetes) ? [...item.paquetes] : [];

        // ✅ Si NO vienen paquetes, solo permitimos 1 (compat).
        // Si cantidad > 1, obligamos a que envíen paquetes[] para no “inventar” códigos repetidos.
        if (paquetes.length === 0) {
          const cantidadCompat = toNonNegInt(item.cantidad, 0);

          if (cantidadCompat > 1) {
            throw new Error(
              "Faltan paquetes[]: si cantidad > 1 debes enviar item.paquetes[] con un código por paquete"
            );
          }

          const fallbackCodigo =
            item.codigoBarrasIngreso ||
            item.codigo_barras_producto_compra ||
            null;

          if (!fallbackCodigo) {
            throw new Error(
              "Falta códigos de barras: envía item.paquetes[] o item.codigo_barras_producto_compra"
            );
          }

          paquetes = [
            {
              codigoBarrasIngreso: fallbackCodigo,
              fechaVencimiento: item.fecha_vencimiento || item.fechaVencimiento,
            },
          ];
        }

        // ✅ cantidad paquetes real (la que vamos a guardar)
        const cantidadPaquetes = paquetes.length;

        // ✅ total unidades real (solo si unidadesPorPaquete > 0)
        const totalUnidades = cantidadPaquetes * unidadesPorPaquete;

        // ✅ Stock por unidades (recomendado)
        if (totalUnidades > 0) {
          await tx.productos.update({
            where: { id_producto: idProducto },
            data: { stock_actual: { increment: totalUnidades } },
          });
        }

        // ✅ por cada paquete => detalle_producto + detalle_compra (1 fila por paquete)
        for (const pack of paquetes) {
          const codigoBarras = pack?.codigoBarrasIngreso
            ? String(pack.codigoBarrasIngreso).trim()
            : pack?.codigo_barras_producto_compra
            ? String(pack.codigo_barras_producto_compra).trim()
            : null;

          if (!codigoBarras) throw new Error("Paquete inválido: falta codigoBarrasIngreso");

          // ✅ FIX: si el pack no trae fecha, usa la fecha del item
          const fechaVenc = parseFecha(
            pack?.fechaVencimiento ||
              pack?.fecha_vencimiento ||
              item?.fecha_vencimiento ||
              item?.fechaVencimiento
          );

          // buscar si ya existe ese codigo para ese producto
          let detalleProducto = await tx.detalle_productos.findFirst({
            where: {
              id_producto: idProducto,
              codigo_barras_producto_compra: codigoBarras,
            },
          });

          if (!detalleProducto) {
            detalleProducto = await tx.detalle_productos.create({
              data: {
                id_producto: idProducto,
                codigo_barras_producto_compra: codigoBarras,
                fecha_vencimiento: fechaVenc,
                stock_producto: 0,
                es_devolucion: false,
                estado: true,
                lote: loteTexto,
              },
            });
          } else {
            // actualizar datos opcionales
            const updates = {};
            if (fechaVenc) updates.fecha_vencimiento = fechaVenc;
            if (loteTexto && !detalleProducto.lote) updates.lote = loteTexto;

            if (Object.keys(updates).length) {
              await tx.detalle_productos.update({
                where: { id_detalle_producto: detalleProducto.id_detalle_producto },
                data: updates,
              });
            }
          }

          // ✅ stock del lote: sube por unidades
          if (unidadesPorPaquete > 0) {
            await tx.detalle_productos.update({
              where: { id_detalle_producto: detalleProducto.id_detalle_producto },
              data: { stock_producto: { increment: unidadesPorPaquete } },
            });
          }

          // ✅ detalle_compra (1 línea por paquete)
          await tx.detalle_compra.create({
            data: {
              id_compra: compra.id_compra,
              id_detalle_producto: detalleProducto.id_detalle_producto,

              cantidad: 1,

              cantidad_paquetes: 1,
              unidades_por_paquete: unidadesPorPaquete,
              cantidad_total_unidades: unidadesPorPaquete,

              precio_unitario: precioUnit,
              precio_venta: precioVenta,

              subtotal: 1 * precioUnit,
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
    return res.status(500).json({
      message: "Error al registrar la compra",
      error: error.message,
    });
  }
};

exports.getPurchases = async (req, res) => {
  try {
    const compras = await prisma.compras.findMany({
      orderBy: { id_compra: "desc" },
      include: {
        proveedores: { select: { nombre: true, nit: true } },
        detalle_compra: {
          include: {
            detalle_productos: {
              include: {
                productos: { select: { id_producto: true, nombre: true } },
              },
            },
          },
        },
      },
    });

    return res.json(compras);
  } catch (error) {
    console.error("❌ getPurchases:", error);
    return res.status(500).json({
      message: "Error al listar compras",
      error: error.message,
    });
  }
};
