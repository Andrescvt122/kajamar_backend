// src/controllers/purchase.controller.js
const { PrismaClient } = require("@prisma/client");
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

    if (!id_proveedor || !Array.isArray(items) || items.length === 0) {
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
        const ivaPctCalc = toNumber(item.iva_porcentaje, 0);
        const icuPctCalc = toNumber(item.icu_porcentaje, 0);

        const paquetesArr = Array.isArray(item.paquetes) ? item.paquetes : [];
        const cantidadPaquetes =
          paquetesArr.length > 0 ? paquetesArr.length : toNonNegInt(item.cantidad, 0);

        if (cantidadPaquetes <= 0) throw new Error("Item inválido: cantidad_paquetes <= 0");

        const sub = cantidadPaquetes * precioUnit;
        subtotal += sub;
        totalImpuestos += sub * ((ivaPctCalc + icuPctCalc) / 100);
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
        const precioVenta = toDecimalOrNull(item.precio_venta);

        const ivaPct = toDecimalOrNull(item.iva_porcentaje);
        const icuPct = toDecimalOrNull(item.icu_porcentaje);

        const traeIva = item.iva_porcentaje !== undefined && item.iva_porcentaje !== "";
        const traeIcu = item.icu_porcentaje !== undefined && item.icu_porcentaje !== "";
        const traePrecio = item.precio_venta !== undefined && item.precio_venta !== "";

        const unidadesPorPaquete = toNonNegInt(
          item.unidades_por_paquete ?? item.unidadesPorPaquete ?? 0,
          0
        );

        let paquetes = Array.isArray(item.paquetes) ? [...item.paquetes] : [];

        if (paquetes.length === 0) {
          const cantidadCompat = toNonNegInt(item.cantidad, 0);
          if (cantidadCompat > 1) {
            throw new Error(
              "Faltan paquetes[]: si cantidad > 1 debes enviar item.paquetes[] con un código por paquete"
            );
          }

          const fallbackCodigo =
            item.codigoBarrasIngreso || item.codigo_barras_producto_compra || null;

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

        const cantidadPaquetes = paquetes.length;
        const totalUnidades = cantidadPaquetes * unidadesPorPaquete;

        // ✅ CÁLCULO costo_unitario (costo_total / cantidad_total_unidades)
        const costoTotal = cantidadPaquetes * precioUnit;
        const costoUnitarioCalc = totalUnidades > 0 ? costoTotal / totalUnidades : null;

        // ✅ PRECIO ANTERIOR DEL PRODUCTO (ANTES de actualizar)
        const prodPrev = await tx.productos.findUnique({
          where: { id_producto: idProducto },
          select: { precio_venta: true },
        });
        const precioAnteriorProducto = prodPrev?.precio_venta ?? null;

        // ✅ incremento_venta: (precio anterior del producto / precio actual) - 1
        const incrementoVentaCalc =
          precioAnteriorProducto != null &&
          Number(precioAnteriorProducto) !== 0 &&
          precioVenta != null &&
          Number(precioVenta) !== 0
            ? (Number(precioAnteriorProducto) / Number(precioVenta)) - 1
            : null;

        // ✅ Actualiza producto base: stock + precio_venta (+ costo_unitario)
        const dataProdUpdate = {};
        if (totalUnidades > 0) dataProdUpdate.stock_actual = { increment: totalUnidades };

        // productos.precio_venta y costo_unitario son Int (redondeo)
        if (precioVenta != null) dataProdUpdate.precio_venta = Math.round(Number(precioVenta));
        if (costoUnitarioCalc != null)
          dataProdUpdate.costo_unitario = Math.round(Number(costoUnitarioCalc));

        if (Object.keys(dataProdUpdate).length > 0) {
          await tx.productos.update({
            where: { id_producto: idProducto },
            data: dataProdUpdate,
          });
        }

        // ✅ por cada paquete => detalle_producto + detalle_compra
        for (const pack of paquetes) {
          const codigoBarras = pack?.codigoBarrasIngreso
            ? String(pack.codigoBarrasIngreso).trim()
            : pack?.codigo_barras_producto_compra
            ? String(pack.codigo_barras_producto_compra).trim()
            : null;

          if (!codigoBarras) throw new Error("Paquete inválido: falta codigoBarrasIngreso");

          const fechaVenc = parseFecha(
            pack?.fechaVencimiento ||
              pack?.fecha_vencimiento ||
              item?.fecha_vencimiento ||
              item?.fechaVencimiento
          );

          let detalleProducto = await tx.detalle_productos.findFirst({
            where: { id_producto: idProducto, codigo_barras_producto_compra: codigoBarras },
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

                // ✅ desde compra
                iva_porcentaje: traeIva ? ivaPct : null,
                icu_porcentaje: traeIcu ? icuPct : null,
                precio_venta: traePrecio ? precioVenta : null,

                // ✅ NUEVO
                costo_unitario: costoUnitarioCalc,
                incremento_venta: incrementoVentaCalc, // ✅ ahora sí se calcula siempre que haya precioAnteriorProducto y precioVenta
              },
            });
          } else {
            const updates = {};
            if (fechaVenc) updates.fecha_vencimiento = fechaVenc;

            // ✅ solo pisa si vienen
            if (traeIva) updates.iva_porcentaje = ivaPct;
            if (traeIcu) updates.icu_porcentaje = icuPct;
            if (traePrecio) updates.precio_venta = precioVenta;

            // ✅ NUEVO
            if (costoUnitarioCalc != null) updates.costo_unitario = costoUnitarioCalc;
            if (incrementoVentaCalc != null) updates.incremento_venta = incrementoVentaCalc;

            if (Object.keys(updates).length) {
              await tx.detalle_productos.update({
                where: { id_detalle_producto: detalleProducto.id_detalle_producto },
                data: updates,
              });
            }
          }

          // ✅ stock del detalle: sube por unidades
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
              precio_venta: precioVenta ?? 0,

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
