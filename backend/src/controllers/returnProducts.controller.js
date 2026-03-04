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
  if (!responsable) return res.status(400).json({ error: "Responsable inválido" });

  if (!Array.isArray(data.products) || data.products.length === 0) {
    return res.status(400).json({ error: "Debe enviar al menos un producto" });
  }

  const cantidadTotal = data.products.reduce((acc, p) => acc + Number(p.cantidad || 0), 0);

  // 1) Validar compra
  const compra = await prisma.compras.findUnique({
    where: { id_compra: Number(data.id_compra) },
    include: {
      detalle_compra: { include: { detalle_productos: true } },
    },
  });

  if (!compra) {
    return res.status(404).json({ error: "La compra especificada no existe" });
  }

  // Productos permitidos por compra (a nivel id_producto)
  const purchaseProductIds = new Set(
    compra.detalle_compra.map((dc) => dc?.detalle_productos?.id_producto).filter(Boolean)
  );

  const isValidReturn = data.products.every((p) => purchaseProductIds.has(Number(p.id_producto)));
  if (!isValidReturn) {
    return res.status(400).json({
      error: "Uno o más productos no pertenecen a la compra especificada",
    });
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // 2) Crear cabecera devolución
        const returnProduct = await tx.devolucion_producto.create({
          data: {
            id_responsable: responsable.usuario_id,
            id_compras: Number(data.id_compra),
            numero_factura: data.numero_factura ?? null,
            fecha_devolucion: new Date(),
            cantidad_total: cantidadTotal,
            nombre_responsable: responsable.nombre,
            estado: true,
            tipo_devolucion: "reemplazo", // tu default, aunque existan líneas con descuento
          },
        });

        // 3) Procesar líneas
        for (const p of data.products) {
          const origenId = Number(p.id_detalle_producto);
          const creadoId =
            p.id_detalle_producto_creado == null
              ? null
              : Number(p.id_detalle_producto_creado);
          const cantidad = Number(p.cantidad);
          const esDescuento = Boolean(p.es_descuento);

          if (!Number.isFinite(origenId) || origenId <= 0) {
            throw new Error("id_detalle_producto (origen) inválido");
          }
          if (!Number.isFinite(cantidad) || cantidad <= 0) {
            throw new Error("cantidad inválida");
          }

          // En reemplazo sí exigimos detalle creado; en descuento no.
          if (!esDescuento && (!Number.isFinite(creadoId) || creadoId <= 0)) {
            throw new Error("Debe enviar id_detalle_producto_creado (detalle nuevo creado desde el front)");
          }

          // 3.1) Traer detalle origen
          const detalleOrigen = await tx.detalle_productos.findUnique({
            where: { id_detalle_producto: origenId },
            select: {
              id_detalle_producto: true,
              id_producto: true,
              stock_producto: true,
              estado: true,
            },
          });
          if (!detalleOrigen) throw new Error(`No existe detalle_productos origen: ${origenId}`);
          if (detalleOrigen.estado === false) throw new Error(`El detalle origen #${origenId} está inactivo`);

          // 3.2) Validar stock origen suficiente
          if (detalleOrigen.stock_producto < cantidad) {
            throw new Error(
              `Stock insuficiente en el detalle origen #${origenId} (${detalleOrigen.stock_producto} < ${cantidad})`
            );
          }

          let detalleCreado = null;
          if (!esDescuento) {
            // 3.3) Traer detalle creado (desde front) para reemplazo
            detalleCreado = await tx.detalle_productos.findUnique({
              where: { id_detalle_producto: creadoId },
              select: {
                id_detalle_producto: true,
                id_producto: true,
                stock_producto: true,
                estado: true,
              },
            });
            if (!detalleCreado) throw new Error(`No existe detalle_productos creado: ${creadoId}`);
            if (detalleCreado.estado === false) throw new Error(`El detalle creado #${creadoId} está inactivo`);

            // 3.4) Validación coherencia: mismo producto (swap correcto)
            if (detalleCreado.id_producto !== detalleOrigen.id_producto) {
              throw new Error(
                `El detalle creado #${creadoId} no pertenece al mismo producto del origen #${origenId}`
              );
            }

            // 3.5) Evitar reusar el mismo detalle creado en otra devolución activa (recomendado)
            const yaUsado = await tx.detalle_devolucion_producto.findFirst({
              where: {
                id_detalle_producto_creado: creadoId,
                estado: true,
              },
              select: { id_detalle_devolucion_productos: true },
            });
            if (yaUsado) {
              throw new Error(`El detalle creado #${creadoId} ya está asociado a otra devolución activa`);
            }
          }

          // Para descuento no se abre modal de registro, así que permitimos
          // usar el detalle origen como referencia técnica de "creado".
          const detalleCreadoIdFinal =
            Number.isFinite(creadoId) && creadoId > 0 ? creadoId : origenId;

          // 3.7) Movimiento stock:
          // Siempre sale del origen
          await tx.detalle_productos.update({
            where: { id_detalle_producto: detalleOrigen.id_detalle_producto },
            data: { stock_producto: { decrement: cantidad } },
          });

          // Solo entra al creado si NO es descuento (reemplazo)
          if (!esDescuento && detalleCreado) {
            await tx.detalle_productos.update({
              where: { id_detalle_producto: detalleCreado.id_detalle_producto },
              data: { stock_producto: { increment: cantidad } },
            });
          }
          console.log("sigue a crear detalle");
          // 3.8) Persistir línea de detalle de devolución para que el listado
          // pueda mostrar cada producto de forma correcta.
          await tx.detalle_devolucion_producto.create({
            data: {
              id_devolucion_producto: returnProduct.id_devolucion_product,
              id_detalle_producto: detalleOrigen.id_detalle_producto,
              id_detalle_producto_creado: detalleCreadoIdFinal,
              cantidad_devuelta: cantidad,
              motivo: p.motivo ?? null,
              nombre_producto: p.nombre_producto ?? null,
              es_descuento: esDescuento,
              estado: true,
            },
          });
        }

        // 4) Respuesta
        return tx.devolucion_producto.findUnique({
          where: { id_devolucion_product: returnProduct.id_devolucion_product },
          include: {
            compras: { include: { proveedores: true } },
            detalle_devolucion_producto: true,
          },
        });
      },
      { timeout: 20000 }
    );

    return res.status(201).json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message ?? "Error al crear la devolución" });
  }
};

const anularReturnProduct = async (req, res) => {
  const { id } = req.params;
  const devolucionId = Number(id);

  if (!Number.isFinite(devolucionId)) {
    return res.status(400).json({ error: "ID inválido" });
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // 1) Traer devolución + líneas
        const devolucion = await tx.devolucion_producto.findUnique({
          where: { id_devolucion_product: devolucionId },
          include: { detalle_devolucion_producto: true },
        });

        if (!devolucion) {
          return { ok: false, status: 404, payload: { error: "Devolución no encontrada" } };
        }

        if (devolucion.estado === false) {
          return { ok: false, status: 400, payload: { error: "La devolución ya está anulada" } };
        }

        const lineas = devolucion.detalle_devolucion_producto.filter((l) => l.estado !== false);

        // 2) Validaciones mínimas
        for (const l of lineas) {
          if (!l.id_detalle_producto || !l.cantidad_devuelta) {
            return {
              ok: false,
              status: 409,
              payload: { error: "No se puede anular: falta id_detalle_producto o cantidad_devuelta en alguna línea." },
            };
          }
          // Solo en reemplazo debe existir detalle creado.
          if (!Boolean(l.es_descuento) && !l.id_detalle_producto_creado) {
            return {
              ok: false,
              status: 409,
              payload: { error: "No se puede anular: falta id_detalle_producto_creado en una línea de reemplazo." },
            };
          }
        }

        const idsLineas = lineas.map((l) => l.id_detalle_devolucion_productos);
        const idsDetallesCreados = Array.from(
          new Set(
            lineas
              .filter((l) => !Boolean(l.es_descuento))
              .map((l) => Number(l.id_detalle_producto_creado))
              .filter((x) => Number.isFinite(x) && x > 0)
          )
        );

        // Bloquea anulación si algún detalle creado ya está relacionado
        // en tablas externas a esta devolución.
        if (idsDetallesCreados.length) {
          const [
            relVenta,
            relCompra,
            relBaja,
            relDevCliente,
            relFactura,
            relConversion,
            relDevProducto,
          ] = await Promise.all([
            tx.detalle_venta.findFirst({
              where: { id_detalle_producto: { in: idsDetallesCreados } },
              select: { id_detalle: true },
            }),
            tx.detalle_compra.findFirst({
              where: { id_detalle_producto: { in: idsDetallesCreados } },
              select: { id_detalle: true },
            }),
            tx.detalle_productos_baja.findFirst({
              where: { id_detalle_productos: { in: idsDetallesCreados } },
              select: { id_detalle_productos_baja: true },
            }),
            tx.devolucion_cliente_entregado.findFirst({
              where: { id_detalle_producto: { in: idsDetallesCreados } },
              select: { id_devolucion_cliente_entregado: true },
            }),
            tx.facturas.findFirst({
              where: { id_detalle_producto: { in: idsDetallesCreados } },
              select: { id_factura: true },
            }),
            tx.detalle_conversion_productos.findFirst({
              where: {
                OR: [
                  { id_detalle_origen: { in: idsDetallesCreados } },
                  { id_detalle_destino: { in: idsDetallesCreados } },
                ],
              },
              select: { id_detalle_conversion: true },
            }),
            tx.detalle_devolucion_producto.findFirst({
              where: {
                OR: [
                  { id_detalle_producto: { in: idsDetallesCreados } },
                  { id_detalle_producto_creado: { in: idsDetallesCreados } },
                ],
                NOT: { id_detalle_devolucion_productos: { in: idsLineas } },
              },
              select: { id_detalle_devolucion_productos: true },
            }),
          ]);

          const tablasRelacionadas = [];
          if (relVenta) tablasRelacionadas.push("detalle_venta");
          if (relCompra) tablasRelacionadas.push("detalle_compra");
          if (relBaja) tablasRelacionadas.push("detalle_productos_baja");
          if (relDevCliente) tablasRelacionadas.push("devolucion_cliente_entregado");
          if (relFactura) tablasRelacionadas.push("facturas");
          if (relConversion) tablasRelacionadas.push("detalle_conversion_productos");
          if (relDevProducto) tablasRelacionadas.push("detalle_devolucion_producto");

          if (tablasRelacionadas.length) {
            return res.json({
              ok: false,
              status: 409,
              payload: {
                error:
                  `No se puede anular la devolucion porque los productos creados estan siendo usados en: ` +
                  tablasRelacionadas.join(", "),
              },
            });
          }
        }

        // 3) Traer detalles (origen + creado) en una sola consulta
        const idsDetalles = Array.from(
          new Set(
            lineas
              .flatMap((l) => [Number(l.id_detalle_producto), Number(l.id_detalle_producto_creado)])
              .filter((x) => Number.isFinite(x) && x > 0)
          )
        );

        const detalles = await tx.detalle_productos.findMany({
          where: { id_detalle_producto: { in: idsDetalles } },
          select: { id_detalle_producto: true, stock_producto: true },
        });

        const detalleMap = new Map(detalles.map((d) => [d.id_detalle_producto, d]));

        // 4) Construir deltas agregados (detalle)
        const deltaDetalleInc = new Map(); // origen +n
        const deltaDetalleDec = new Map(); // creado -n (solo reemplazo)

        const addTo = (m, key, val) => m.set(key, (m.get(key) ?? 0) + val);

        for (const l of lineas) {
          const origenId = Number(l.id_detalle_producto);
          const creadoId = Number(l.id_detalle_producto_creado);
          const cant = Number(l.cantidad_devuelta);
          const esDescuento = Boolean(l.es_descuento);

          addTo(deltaDetalleInc, origenId, cant);

          // Solo se revierte el creado si fue reemplazo (no descuento)
          if (!esDescuento) {
            addTo(deltaDetalleDec, creadoId, cant);
          }
        }

        // 5) Anti-negativo: el detalle creado debe tener stock suficiente para decrementar (solo reemplazo)
        for (const [detalleCreadoId, dec] of deltaDetalleDec.entries()) {
          const det = detalleMap.get(detalleCreadoId);
          if (!det) {
            return {
              ok: false,
              status: 409,
              payload: { error: `Inconsistencia: no existe detalle_productos creado #${detalleCreadoId}` },
            };
          }
          if (det.stock_producto < dec) {
            return {
              ok: false,
              status: 409,
              payload: {
                error:
                  `No se puede anular: el detalle creado #${detalleCreadoId} no tiene stock suficiente ` +
                  `para revertir (${det.stock_producto} < ${dec}). Probablemente ya se vendió/consumió el reemplazo.`,
              },
            };
          }
        }

        // 6) Marcar devolución como anulada (soft)
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

        // 8) Soft delete líneas
        if (idsLineas.length) {
          await tx.detalle_devolucion_producto.updateMany({
            where: { id_detalle_devolucion_productos: { in: idsLineas } },
            data: { estado: false },
          });
        }

        // 9) Soft delete de detalles creados (si no se usaron en ventas/facturas)
        if (idsDetallesCreados.length) {
          const usosVenta = await tx.detalle_venta.findMany({
            where: { id_detalle_producto: { in: idsDetallesCreados } },
            select: { id_detalle_producto: true },
          });

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

        // 10) Respuesta final
        const devolucionFinal = await tx.devolucion_producto.findUnique({
          where: { id_devolucion_product: devolucionId },
          include: { detalle_devolucion_producto: true, compras: { include: { proveedores: true } } },
        });

        return { ok: true, status: 200, payload: devolucionFinal };
      },
      { timeout: 20000 }
    );

    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message ?? "Error al anular la devolución" });
  }
};


module.exports = {
  getReturnProducts,
  searchReturnProdcts,
  createReturnProduct,
  getResponsable,
  anularReturnProduct,
};
