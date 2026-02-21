const prisma = require("../prisma/prismaClient");

const getResponsable = async (id) => {
  try {
    const responsable = await prisma.usuarios.findUnique({
      where: {
        usuario_id: id,
      },
    });
    return responsable;
  } catch (error) {
    console.log("No se encontro responsable");
  }
};

const getReturnProducts = async (req, res) => {
  try {
    const returnProducts = await prisma.devolucion_producto.findMany({
      orderBy: { id_devolucion_product: "desc" },
      include: {
        // âœ… proveedor real, por compra
        compras: {
          include: {
            proveedores: true,
          },
        },

        // si quieres seguir trayendo el detalle
        detalle_devolucion_producto: {
          include: {
            detalle_productos: {
              include: {
                productos: true, // suficiente para nombre/SKU
              },
            },
          },
        },
      },
    });

    return res.status(200).json({ returnProducts });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al obtener los productos" });
  }
};

const searchReturnProdcts = async (req, res) => {
  const { q } = req.query;
  const isNumber = !isNaN(q);
  console.log(q);
  const filter = isNumber
    ? {
        OR: [
          { id_devolucion_product: { equals: Number(q) } },
          { fecha_devolucion: { contains: q } },
          { cantidad_total: { equals: Number(q) } },
          {
            detalle_devolucion_producto: {
              some: {
                OR: [
                  {
                    cantidad_devuelta: { equals: Number(q) },
                  },
                ],
              },
            },
          },
        ],
      }
    : {
        OR: [
          {
            nombre_responsable: { contains: q, mode: "insensitive" },
          },
          {
            OR: [
              {
                detalle_devolucion_producto: {
                  some: {
                    OR: [
                      {
                        nombre_producto: { contains: q, mode: "insensitive" },
                      },
                      {
                        motivo: { contains: q, mode: "insensitive" },
                      },
                    ],
                  },
                },
              },
            ],
          },
        ],
      };
  try {
    const returnProducts = await prisma.devolucion_producto.findMany({
      where: filter,
      include: { detalle_devolucion_producto: true },
    });
    return res.status(200).json({ returnProducts });
  } catch (error) {
    return res.status(500).json({ error: "Error al obtener el producto" });
  }
};

const createReturnProduct = async (req, res) => {
  const data = req.body;

  const responsable = await getResponsable(Number(data.id_responsable));
  if (!responsable)
    return res.status(400).json({ error: "Responsable invÃ¡lido" });

  const cantidadTotal = data.products.reduce(
    (acc, p) => acc + Number(p.cantidad || 0),
    0,
  );

  // 1) Validar compra
  const compra = await prisma.compras.findUnique({
    where: { id_compra: Number(data.id_compra) },
    include: {
      detalle_compra: { include: { detalle_productos: true } },
    },
  });

  if (!compra)
    return res.status(404).json({ error: "La compra especificada no existe" });

  const purchaseProductIds = new Set(
    compra.detalle_compra
      .map((dc) => dc?.detalle_productos?.id_producto)
      .filter(Boolean),
  );
  const purchaseDetailIds = new Set(
    compra.detalle_compra
      .map((dc) =>
        Number(
          dc?.id_detalle_producto ?? dc?.detalle_productos?.id_detalle_producto,
        ),
      )
      .filter(Number.isFinite),
  );

  const isValidReturn = data.products.every((p) =>
    purchaseProductIds.has(Number(p.id_producto)),
  );
  if (!isValidReturn) {
    return res.status(400).json({
      error: "Uno o mÃ¡s productos no pertenecen a la compra especificada",
    });
  }
  const isValidReturnDetail = data.products.every((p) =>
    purchaseDetailIds.has(Number(p.id_detalle_producto)),
  );
  if (!isValidReturnDetail) {
    return res.status(400).json({
      error:
        "Uno o mÃ¡s id_detalle_producto no pertenecen a la compra especificada",
    });
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // 2) Crear cabecera devoluciÃ³n
        const returnProduct = await tx.devolucion_producto.create({
          data: {
            id_responsable: responsable.usuario_id,
            id_compras: Number(data.id_compra),
            numero_factura: data.numero_factura ?? null,
            fecha_devolucion: new Date(),
            cantidad_total: cantidadTotal,
            nombre_responsable: responsable.nombre,
            estado: true,

            // âœ… por defecto reemplazo
            tipo_devolucion: "reemplazo",
          },
        });

        // 3) Procesar lÃ­neas
        for (const p of data.products) {
          const origenId = Number(p.id_detalle_producto);
          const cantidad = Number(p.cantidad);

          if (
            !Number.isFinite(origenId) ||
            !Number.isFinite(cantidad) ||
            cantidad <= 0
          ) {
            throw new Error(
              "Datos invÃ¡lidos en productos: id_detalle_producto/cantidad",
            );
          }

          // 3.1) Traer detalle origen
          const detalleOrigen = await tx.detalle_productos.findUnique({
            where: { id_detalle_producto: origenId },
            select: {
              id_detalle_producto: true,
              id_producto: true,
              stock_producto: true,
            },
          });
          if (!detalleOrigen)
            throw new Error(`No existe detalle_productos origen: ${origenId}`);

          // 3.2) Validar stock origen suficiente
          if (detalleOrigen.stock_producto < cantidad) {
            throw new Error(
              `Stock insuficiente en el detalle origen #${origenId} (${detalleOrigen.stock_producto} < ${cantidad})`,
            );
          }

          // ✅ 3.3) USAR detalle creado desde el front
          const creadoId = Number(p.id_detalle_producto_creado);
          if (!Number.isFinite(creadoId) || creadoId <= 0) {
            throw new Error(
              "Debe enviar id_detalle_producto_creado (detalle nuevo creado desde el front)",
            );
          }

          const detalleCreado = await tx.detalle_productos.findUnique({
            where: { id_detalle_producto: creadoId },
            select: {
              id_detalle_producto: true,
              id_producto: true,
              stock_producto: true,
              estado: true,
            },
          });

          if (!detalleCreado)
            throw new Error(`No existe detalle_productos creado: ${creadoId}`);
          if (detalleCreado.estado === false)
            throw new Error(`El detalle creado #${creadoId} está inactivo`);

          // ✅ Validación de coherencia: mismo producto
          if (detalleCreado.id_producto !== detalleOrigen.id_producto) {
            throw new Error(
              `El detalle creado #${creadoId} no pertenece al mismo producto del origen #${origenId}`,
            );
          }

          // 3.4) Crear registro detalle_devolucion (origen + detalle creado)
          await tx.detalle_devolucion_producto.create({
            data: {
              id_devolucion_producto: returnProduct.id_devolucion_product,
              id_detalle_producto: detalleOrigen.id_detalle_producto,
              id_detalle_producto_creado: detalleCreado.id_detalle_producto,
              cantidad_devuelta: cantidad,
              motivo: p.motivo ?? null,
              nombre_producto: p.nombre_producto ?? null,
              es_descuento: p.es_descuento ?? false,
              estado: true,
            },
          });

          // 3.5) Movimiento stock mano a mano:
          await tx.detalle_productos.update({
            where: { id_detalle_producto: detalleOrigen.id_detalle_producto },
            data: { stock_producto: { decrement: cantidad } },
          });

          await tx.detalle_productos.update({
            where: { id_detalle_producto: detalleCreado.id_detalle_producto },
            data: { stock_producto: { increment: cantidad } },
          });

          // âœ… IMPORTANTE:
          // Como es reemplazo, el stock global NO cambia (neto 0).
          // Si algÃºn dÃ­a haces tipo_devolucion="definitiva", ahÃ­ sÃ­ decrementas productos.stock_actual.
        }

        // 4) Respuesta
        return tx.devolucion_producto.findUnique({
          where: { id_devolucion_product: returnProduct.id_devolucion_product },
          include: {
            detalle_devolucion_producto: true,
          },
        });
      },
      { timeout: 20000 },
    );

    return res.status(201).json(result);
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: error.message ?? "Error al crear la devoluciÃ³n" });
  }
};

const anularReturnProduct = async (req, res) => {
  const { id } = req.params;
  const devolucionId = Number(id);

  if (!Number.isFinite(devolucionId)) {
    return res.status(400).json({ error: "ID invÃ¡lido" });
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // 1) Traer devoluciÃ³n + lÃ­neas
        const devolucion = await tx.devolucion_producto.findUnique({
          where: { id_devolucion_product: devolucionId },
          include: { detalle_devolucion_producto: true },
        });

        if (!devolucion) {
          return {
            ok: false,
            status: 404,
            payload: { error: "DevoluciÃ³n no encontrada" },
          };
        }

        if (devolucion.estado === false) {
          return {
            ok: false,
            status: 400,
            payload: { error: "La devoluciÃ³n ya estÃ¡ anulada" },
          };
        }

        // 2) Validar que todas las lÃ­neas tengan origen y detalle creado (reemplazo)
        const lineas = devolucion.detalle_devolucion_producto.filter(
          (l) => l.estado !== false,
        );

        for (const l of lineas) {
          if (
            !l.id_detalle_producto ||
            !l.id_detalle_producto_creado ||
            !l.cantidad_devuelta
          ) {
            return {
              ok: false,
              status: 409,
              payload: {
                error:
                  "No se puede anular: faltan referencias de origen/detalle creado o cantidad_devuelta en alguna lÃ­nea.",
              },
            };
          }
        }

        // 3) Traer detalles origen+creado en una sola consulta
        const idsDetalles = Array.from(
          new Set(
            lineas
              .flatMap((l) => [
                l.id_detalle_producto,
                l.id_detalle_producto_creado,
              ])
              .filter((x) => Number.isFinite(x)),
          ),
        );

        const detalles = await tx.detalle_productos.findMany({
          where: { id_detalle_producto: { in: idsDetalles } },
          select: {
            id_detalle_producto: true,
            id_producto: true,
            stock_producto: true,
          },
        });

        const detalleMap = new Map(
          detalles.map((d) => [d.id_detalle_producto, d]),
        );

        // 4) Construir deltas agregados
        const deltaDetalleInc = new Map(); // origen +n
        const deltaDetalleDec = new Map(); // creado -n

        const addTo = (m, key, val) => m.set(key, (m.get(key) ?? 0) + val);

        for (const l of lineas) {
          const origenId = Number(l.id_detalle_producto);
          const creadoId = Number(l.id_detalle_producto_creado);
          const cant = Number(l.cantidad_devuelta);

          addTo(deltaDetalleInc, origenId, cant);
          addTo(deltaDetalleDec, creadoId, cant);
        }

        // 5) ValidaciÃ³n anti-stock-negativo: el detalle creado debe tener stock suficiente para decrementar
        for (const [detalleCreadoId, dec] of deltaDetalleDec.entries()) {
          const det = detalleMap.get(detalleCreadoId);
          if (!det) {
            return {
              ok: false,
              status: 409,
              payload: {
                error: `Inconsistencia: no existe detalle_productos creado #${detalleCreadoId}`,
              },
            };
          }
          if (det.stock_producto < dec) {
            return {
              ok: false,
              status: 409,
              payload: {
                error:
                  `No se puede anular: el detalle creado #${detalleCreadoId} no tiene stock suficiente ` +
                  `para revertir (${det.stock_producto} < ${dec}). ` +
                  `Probablemente ya se vendiÃ³/consumiÃ³ el reemplazo.`,
              },
            };
          }
        }

        // 6) Marcar devoluciÃ³n como anulada (soft)
        await tx.devolucion_producto.update({
          where: { id_devolucion_product: devolucionId },
          data: { estado: false },
        });

        // 7) Rollback stocks (detalles)
        for (const [detalleId, inc] of deltaDetalleInc.entries()) {
          await tx.detalle_productos.update({
            where: { id_detalle_producto: detalleId },
            data: { stock_producto: { increment: inc } },
          });
        }

        for (const [detalleId, dec] of deltaDetalleDec.entries()) {
          await tx.detalle_productos.update({
            where: { id_detalle_producto: detalleId },
            data: { stock_producto: { decrement: dec } },
          });
        }

        // 8) Soft delete lÃ­neas
        const idsLineas = lineas.map((l) => l.id_detalle_devolucion_productos);

        if (idsLineas.length) {
          await tx.detalle_devolucion_producto.updateMany({
            where: { id_detalle_devolucion_productos: { in: idsLineas } },
            data: { estado: false },
          });
        }
        // ✅ 8.5) Soft delete de detalles creados por esta devolución (si no se usaron)
        const idsDetallesCreados = lineas
          .map((l) => Number(l.id_detalle_producto_creado))
          .filter((x) => Number.isFinite(x) && x > 0);

        if (idsDetallesCreados.length) {
          // si aparecen en ventas, no los puedes apagar
          const usosVenta = await tx.detalle_venta.findMany({
            where: { id_detalle_producto: { in: idsDetallesCreados } },
            select: { id_detalle_producto: true },
          });

          // si aparecen en facturas, tampoco (por tu schema facturas -> detalle_productos)
          const usosFactura = await tx.facturas.findMany({
            where: { id_detalle_producto: { in: idsDetallesCreados } },
            select: { id_detalle_producto: true },
          });

          const usados = new Set([
            ...usosVenta.map((u) => u.id_detalle_producto),
            ...usosFactura.map((u) => u.id_detalle_producto),
          ]);

          const noUsados = idsDetallesCreados.filter((id) => !usados.has(id));

          if (noUsados.length) {
            await tx.detalle_productos.updateMany({
              where: { id_detalle_producto: { in: noUsados } },
              data: { estado: false, stock_producto: 0 },
            });
          }
        }
        // 9) Respuesta final
        const devolucionFinal = await tx.devolucion_producto.findUnique({
          where: { id_devolucion_product: devolucionId },
          include: { detalle_devolucion_producto: true },
        });

        return { ok: true, status: 200, payload: devolucionFinal };
      },
      { timeout: 20000 },
    );

    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: error.message ?? "Error al anular la devoluciÃ³n" });
  }
};

module.exports = {
  getReturnProducts,
  searchReturnProdcts,
  createReturnProduct,
  getResponsable,
  anularReturnProduct,
};
