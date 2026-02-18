const prisma = require("../prisma/prismaClient");

const fullNameFromUser = (user) =>
  [user?.nombre, user?.apellido].filter(Boolean).join(" ").trim() || null;

const lowProductInclude = {
  usuarios: {
    select: { usuario_id: true, nombre: true, apellido: true },
  },
  detalle_productos_baja: {
    include: {
      detalle_productos: {
        select: {
          id_detalle_producto: true,
          id_producto: true,
          productos: {
            select: { id_producto: true, nombre: true },
          },
        },
      },
    },
  },
  conversionProductos: {
    include: {
      usuarios: {
        select: { usuario_id: true, nombre: true, apellido: true },
      },
      producto_creado: {
        select: { id_producto: true, nombre: true },
      },
      detalle_conversion: {
        include: {
          detalle_origen: {
            select: {
              id_detalle_producto: true,
              id_producto: true,
              productos: {
                select: { id_producto: true, nombre: true },
              },
            },
          },
          detalle_destino: {
            select: {
              id_detalle_producto: true,
              id_producto: true,
              productos: {
                select: { id_producto: true, nombre: true },
              },
            },
          },
        },
      },
    },
  },
};

const enrichConversion = (conversion) => ({
  ...conversion,
  nombre_responsable:
    conversion.nombre_responsable ?? fullNameFromUser(conversion.usuarios),
  detalle_conversion: (conversion.detalle_conversion ?? []).map((detalle) => ({
    ...detalle,
    nombre_producto_origen: detalle.detalle_origen?.productos?.nombre ?? null,
    nombre_producto_destino: detalle.detalle_destino?.productos?.nombre ?? null,
  })),
});

const enrichLowProduct = (lowProduct) => ({
  ...lowProduct,
  nombre_responsable:
    lowProduct.nombre_responsable ?? fullNameFromUser(lowProduct.usuarios),
  detalle_productos_baja: (lowProduct.detalle_productos_baja ?? []).map(
    (detalle) => ({
      ...detalle,
      nombre_producto:
        detalle.nombre_producto ??
        detalle.detalle_productos?.productos?.nombre ??
        null,
    })
  ),
  conversionProductos: (lowProduct.conversionProductos ?? []).map(
    enrichConversion
  ),
});

const getLowProducts = async (req, res) => {
  try {
    const lowProducts = await prisma.productos_baja.findMany({
      include: lowProductInclude,
    });
    return res.status(200).json(lowProducts.map(enrichLowProduct));
  } catch (error) {
    return res.status(500).json({ error: "Error al obtener los productos" });
  }
};

const getOneLowProduct = async (req, res) => {
  const { id } = req.params;
  try {
    const lowProduct = await prisma.productos_baja.findUnique({
      where: {
        id_baja_productos: Number(id),
      },
      include: lowProductInclude,
    });
    return res.status(200).json(lowProduct ? enrichLowProduct(lowProduct) : null);
  } catch (error) {
    return res.status(500).json({ error: "Error al obtener el producto" });
  }
};

const searchLowProduct = async (req, res) => {
  const { q } = req.query;

  if (!q || !String(q).trim()) {
    return res
      .status(400)
      .json({ error: "El parametro de busqueda q es requerido" });
  }

  try {
    const isNumber = !isNaN(q);

    const filter = isNumber
      ? {
          OR: [
            { id_baja_productos: { equals: Number(q) } },
            { cantida_baja: { equals: Number(q) } },
            { total_precio_baja: { equals: Number(q) } },
          ],
        }
      : {
          OR: [
            {
              nombre_responsable: {
                contains: q,
                mode: "insensitive",
              },
            },
            {
              detalle_productos_baja: {
                some: {
                  OR: [
                    {
                      motivo: {
                        contains: q,
                        mode: "insensitive",
                      },
                    },
                    {
                      nombre_producto: {
                        contains: q,
                        mode: "insensitive",
                      },
                    },
                  ],
                },
              },
            },
          ],
        };

    const lowProducts = await prisma.productos_baja.findMany({
      where: filter,
      include: lowProductInclude,
    });

    return res.status(200).json(lowProducts.map(enrichLowProduct));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al buscar los productos" });
  }
};

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

const createLowProduct = async (req, res) => {
  const data = req.body ?? {};
  const responsable = await getResponsable(data.id_responsable);

  if (!Array.isArray(data.products) || !data.products.length) {
    return res
      .status(400)
      .json({ error: "Debe enviar al menos un producto para la baja" });
  }

  const cantidad_total_baja = data.products.reduce(
    (acc, p) => acc + Number(p.cantidad ?? 0),
    0
  );
  const total_precio_baja = data.products.reduce(
    (acc, p) => acc + Number(p.total_producto_baja ?? 0),
    0
  );

  if (!responsable)
    return res.status(400).json({ error: "Responsable invalido" });

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const lowProduct = await tx.productos_baja.create({
          data: {
            id_responsable: responsable.usuario_id,
            fecha_baja: new Date(),
            cantida_baja: cantidad_total_baja,
            total_precio_baja,
            nombre_responsable: fullNameFromUser(responsable),
          },
        });

        for (const p of data.products) {
          const cantidad = Number(p.cantidad ?? 0);
          const totalProductoBaja = Number(p.total_producto_baja ?? 0);

          if (!Number.isFinite(cantidad) || cantidad <= 0) {
            throw new Error(
              `Cantidad invalida para id_detalle_productos ${p.id_detalle_productos}`
            );
          }

          const detalle_origen = await tx.detalle_productos.findUnique({
            where: { id_detalle_producto: Number(p.id_detalle_productos) },
            include: {
              productos: {
                select: { id_producto: true, nombre: true },
              },
            },
          });

          if (!detalle_origen)
            throw new Error(
              `No existe detalle_productos con id ${p.id_detalle_productos}`
            );
          if (!detalle_origen.productos)
            throw new Error(
              `No existe producto asociado al detalle ${p.id_detalle_productos}`
            );

          await tx.detalle_productos_baja.create({
            data: {
              id_baja_productos: lowProduct.id_baja_productos,
              id_detalle_productos: Number(p.id_detalle_productos),
              cantidad,
              motivo: p.motivo,
              total_producto_baja: totalProductoBaja,
              nombre_producto: detalle_origen.productos.nombre,
            },
          });

          await tx.detalle_productos.update({
            where: { id_detalle_producto: Number(p.id_detalle_productos) },
            data: { stock_producto: { decrement: cantidad } },
          });

          await tx.productos.update({
            where: { id_producto: detalle_origen.productos.id_producto },
            data: { stock_actual: { decrement: cantidad } },
          });

          if (p.motivo === "venta unitaria") {
            const factor = Number(p.factor_conversion ?? 0);
            const cantDestino = Number(p.cantidad_traslado ?? 0);

            if (!factor || factor <= 0) {
              throw new Error(
                "factor_conversion es requerido y debe ser > 0 para venta unitaria"
              );
            }
            if (!cantDestino || cantDestino <= 0) {
              throw new Error(
                "cantidad_traslado es requerida y debe ser > 0 para venta unitaria"
              );
            }

            const detalle_destino_id = Number(
              p.id_detalle_destino ?? p.id_producto_traslado
            );
            if (!Number.isFinite(detalle_destino_id) || detalle_destino_id <= 0) {
              throw new Error(
                "Debe enviar id_detalle_destino (o id_producto_traslado) para venta unitaria"
              );
            }

            const detalle_destino = await tx.detalle_productos.findUnique({
              where: { id_detalle_producto: detalle_destino_id },
              select: { id_detalle_producto: true, id_producto: true },
            });

            if (!detalle_destino) {
              throw new Error(
                `No existe detalle destino con id ${detalle_destino_id}`
              );
            }

            const conversion = await tx.conversion_productos.create({
              data: {
                fecha_conversion: new Date(),
                id_responsable: responsable.usuario_id,
                nombre_responsable: fullNameFromUser(responsable),
                estado: true,
                observacion: `Conversion por venta unitaria desde baja #${lowProduct.id_baja_productos}`,
                id_baja_productos: lowProduct.id_baja_productos,
              },
            });

            await tx.detalle_conversion_productos.create({
              data: {
                id_conversion_productos: conversion.id_conversion_productos,
                id_detalle_origen: detalle_origen.id_detalle_producto,
                id_detalle_destino: detalle_destino.id_detalle_producto,
                cantidad_origen: cantidad,
                cantidad_destino: cantDestino,
                factor_conversion: factor,
                estado: true,
              },
            });

            await tx.detalle_productos.update({
              where: { id_detalle_producto: detalle_destino.id_detalle_producto },
              data: { stock_producto: { increment: cantDestino } },
            });

            await tx.productos.update({
              where: { id_producto: detalle_destino.id_producto },
              data: { stock_actual: { increment: cantDestino } },
            });
          }
        }

        return tx.productos_baja.findUnique({
          where: { id_baja_productos: lowProduct.id_baja_productos },
          include: lowProductInclude,
        });
      },
      { timeout: 20000 }
    );

    return res.status(201).json(result ? enrichLowProduct(result) : null);
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: error.message ?? "Error al crear el producto" });
  }
};

const cancelLowProduct = async (req, res) => {
  const { id } = req.params;
  const bajaId = Number(id);

  if (!Number.isFinite(bajaId)) {
    return res.status(400).json({ error: "ID invalido" });
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const baja = await tx.productos_baja.findUnique({
          where: { id_baja_productos: bajaId },
          include: {
            detalle_productos_baja: true,
          },
        });

        if (!baja) {
          return {
            ok: false,
            status: 404,
            payload: { error: "Baja no encontrada" },
          };
        }
        if (baja.estado === false) {
          return {
            ok: false,
            status: 400,
            payload: { error: "La baja ya esta anulada" },
          };
        }

        const conversiones = await tx.conversion_productos.findMany({
          where: { id_baja_productos: bajaId, estado: true },
          include: { detalle_conversion: true },
        });

        const idsDetalleBaja = baja.detalle_productos_baja
          .map((d) => d.id_detalle_productos)
          .filter((x) => Number.isFinite(x));

        const idsDetalleConv = [];

        for (const conv of conversiones) {
          for (const l of conv.detalle_conversion) {
            idsDetalleConv.push(l.id_detalle_origen, l.id_detalle_destino);
          }
        }

        const allDetalleIds = Array.from(
          new Set(
            [...idsDetalleBaja, ...idsDetalleConv].filter((x) =>
              Number.isFinite(x)
            )
          )
        );

        const detalles = await tx.detalle_productos.findMany({
          where: { id_detalle_producto: { in: allDetalleIds } },
          select: {
            id_detalle_producto: true,
            id_producto: true,
            stock_producto: true,
          },
        });

        const detalleMap = new Map(
          detalles.map((d) => [d.id_detalle_producto, d])
        );

        for (const detId of allDetalleIds) {
          if (!detalleMap.has(detId)) {
            return {
              ok: false,
              status: 409,
              payload: {
                error: `Inconsistencia: no existe detalle_productos con id ${detId}`,
              },
            };
          }
        }

        const deltaDetalleInc = new Map();
        const deltaDetalleDec = new Map();
        const deltaProductoInc = new Map();
        const deltaProductoDec = new Map();

        const addTo = (m, key, val) => m.set(key, (m.get(key) ?? 0) + val);

        for (const d of baja.detalle_productos_baja) {
          const detId = d.id_detalle_productos;
          const cant = Number(d.cantidad ?? 0);
          if (!Number.isFinite(detId) || !Number.isFinite(cant) || cant <= 0)
            continue;

          const det = detalleMap.get(detId);
          addTo(deltaDetalleInc, detId, cant);
          addTo(deltaProductoInc, det.id_producto, cant);
        }

        for (const conv of conversiones) {
          for (const l of conv.detalle_conversion) {
            const origenId = l.id_detalle_origen;
            const destinoId = l.id_detalle_destino;

            const cantOrigen = Number(l.cantidad_origen ?? 0);
            const cantDestino = Number(l.cantidad_destino ?? 0);

            if (!Number.isFinite(origenId) || !Number.isFinite(destinoId))
              continue;
            if (!Number.isFinite(cantOrigen) || !Number.isFinite(cantDestino))
              continue;
            if (cantOrigen <= 0 || cantDestino <= 0) continue;

            const detOrigen = detalleMap.get(origenId);
            const detDestino = detalleMap.get(destinoId);

            addTo(deltaDetalleInc, origenId, cantOrigen);
            addTo(deltaProductoInc, detOrigen.id_producto, cantOrigen);

            addTo(deltaDetalleDec, destinoId, cantDestino);
            addTo(deltaProductoDec, detDestino.id_producto, cantDestino);
          }
        }

        const productoIdsDestino = Array.from(deltaProductoDec.keys());
        const productosDestino = await tx.productos.findMany({
          where: { id_producto: { in: productoIdsDestino } },
          select: { id_producto: true, stock_actual: true },
        });
        const productoMap = new Map(
          productosDestino.map((p) => [p.id_producto, p])
        );

        for (const [detalleId, dec] of deltaDetalleDec.entries()) {
          const det = detalleMap.get(detalleId);
          if (det.stock_producto < dec) {
            return {
              ok: false,
              status: 409,
              payload: {
                error:
                  `No se puede anular: el detalle destino #${detalleId} no tiene stock suficiente ` +
                  `para revertir (${det.stock_producto} < ${dec}). ` +
                  `Probablemente ya se vendieron/consumieron unidades.`,
              },
            };
          }
        }

        for (const [prodId, dec] of deltaProductoDec.entries()) {
          const prod = productoMap.get(prodId);
          if (!prod) {
            return {
              ok: false,
              status: 409,
              payload: {
                error: `Inconsistencia: no existe producto destino con id ${prodId}`,
              },
            };
          }
          if (prod.stock_actual < dec) {
            return {
              ok: false,
              status: 409,
              payload: {
                error:
                  `No se puede anular: el producto destino #${prodId} no tiene stock suficiente ` +
                  `para revertir (${prod.stock_actual} < ${dec}).`,
              },
            };
          }
        }

        await tx.productos_baja.update({
          where: { id_baja_productos: bajaId },
          data: { estado: false },
        });

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

        for (const [prodId, inc] of deltaProductoInc.entries()) {
          await tx.productos.update({
            where: { id_producto: prodId },
            data: { stock_actual: { increment: inc } },
          });
        }

        for (const [prodId, dec] of deltaProductoDec.entries()) {
          await tx.productos.update({
            where: { id_producto: prodId },
            data: { stock_actual: { decrement: dec } },
          });
        }

        const idsConversion = conversiones.map((c) => c.id_conversion_productos);
        const idsLineas = conversiones.flatMap((c) =>
          c.detalle_conversion.map((l) => l.id_detalle_conversion)
        );

        if (idsLineas.length) {
          await tx.detalle_conversion_productos.updateMany({
            where: { id_detalle_conversion: { in: idsLineas } },
            data: { estado: false },
          });
        }

        if (idsConversion.length) {
          await tx.conversion_productos.updateMany({
            where: { id_conversion_productos: { in: idsConversion } },
            data: { estado: false },
          });
        }

        const idsProductosCreados = conversiones
          .map((c) => c.id_producto_creado)
          .filter((x) => Number.isFinite(x));

        if (idsProductosCreados.length) {
          const detallesCreados = await tx.detalle_productos.findMany({
            where: { id_producto: { in: idsProductosCreados } },
            select: { id_detalle_producto: true, id_producto: true },
          });

          const idsDetallesCreados = detallesCreados.map(
            (d) => d.id_detalle_producto
          );

          const ventasUsos = idsDetallesCreados.length
            ? await tx.detalle_venta.findMany({
                where: { id_detalle_producto: { in: idsDetallesCreados } },
                select: { id_detalle_producto: true },
              })
            : [];

          const usadosDetalle = new Set(
            ventasUsos.map((v) => v.id_detalle_producto)
          );
          const usadosProducto = new Set(
            detallesCreados
              .filter((d) => usadosDetalle.has(d.id_detalle_producto))
              .map((d) => d.id_producto)
          );

          const noUsados = Array.from(new Set(idsProductosCreados)).filter(
            (pid) => !usadosProducto.has(pid)
          );

          if (noUsados.length) {
            await tx.productos.updateMany({
              where: { id_producto: { in: noUsados } },
              data: { estado: false },
            });
          }
        }

        const bajaFinal = await tx.productos_baja.findUnique({
          where: { id_baja_productos: bajaId },
          include: lowProductInclude,
        });

        return { ok: true, status: 200, payload: bajaFinal };
      },
      { timeout: 20000 }
    );

    if (result.ok) {
      return res
        .status(result.status)
        .json(result.payload ? enrichLowProduct(result.payload) : null);
    }

    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: error.message ?? "Error al anular la baja" });
  }
};

const anularLowProduct = cancelLowProduct;

module.exports = {
  getLowProducts,
  createLowProduct,
  searchLowProduct,
  getOneLowProduct,
  getResponsable,
  cancelLowProduct,
  anularLowProduct,
};
