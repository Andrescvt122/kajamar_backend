const prisma = require("../prisma/prismaClient");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const fullNameFromUser = (user) =>
  [user?.nombre, user?.apellido].filter(Boolean).join(" ").trim() || null;

const getLowProductCreatedAt = (lowProduct) => {
  const createdAt = lowProduct?.created_at
    ? new Date(lowProduct.created_at)
    : lowProduct?.fecha_baja
    ? new Date(lowProduct.fecha_baja)
    : null;

  if (!createdAt || Number.isNaN(createdAt.getTime())) return null;
  return createdAt;
};

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
            select: { id_producto: true, nombre: true, categorias: { select: { id_categoria: true, nombre_categoria: true } } },
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
        select: { id_producto: true, nombre: true, categorias: { select: { id_categoria: true, nombre_categoria: true } } },
      },
      detalle_conversion: {
        include: {
          detalle_origen: {
            select: {
              id_detalle_producto: true,
              id_producto: true,
              productos: {
                select: { id_producto: true, nombre: true, categorias: { select: { id_categoria: true, nombre_categoria: true } } },
              },
            },
          },
          detalle_destino: {
            select: {
              id_detalle_producto: true,
              id_producto: true,
              productos: {
                select: { id_producto: true, nombre: true, categorias: { select: { id_categoria: true, nombre_categoria: true } } },
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

const getAllLowProducts = async (req,res)=>{
  try{
    const lowProducts = await prisma.productos_baja.findMany({
      include: lowProductInclude,
      orderBy: { id_baja_productos: "desc" },
    });
    return res.status(200).json({ data: lowProducts.map(enrichLowProduct) });
  }catch(error){
    console.error(error);
    return res.status(500).json({error:"Error al obtener los productos"})
  }
}

const getLowProducts = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 6;
    const cursor = req.query.cursor ? Number(req.query.cursor) : undefined;
    const safeLimit = Math.min(limit, 20);

    const lowProducts = await prisma.productos_baja.findMany({
      take: safeLimit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id_baja_productos: cursor } : undefined,
      orderBy: { id_baja_productos: "desc" },
      include: lowProductInclude,
    });

    const hasMore = lowProducts.length > safeLimit;
    const data = hasMore ? lowProducts.slice(0, safeLimit) : lowProducts;
    const nextCursor = hasMore ? data[data.length - 1].id_baja_productos : null;

    return res.status(200).json({
      data,
      meta: {
        limit: safeLimit,
        nextCursor,
      },
    });
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
                    {
                      detalle_productos: {
                        is: {
                          productos: {
                            is: {
                              categorias: {
                                is: {
                                  nombre_categoria: {
                                    contains: q,
                                    mode: "insensitive",
                                  },
                                },
                              },
                            },
                          },
                        },
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
    return res.status(400).json({ error: "Debe enviar al menos un producto para la baja" });
  }

  const cantidad_total_baja = data.products.reduce((acc, p) => acc + Number(p.cantidad ?? 0), 0);
  const total_precio_baja = data.products.reduce((acc, p) => acc + Number(p.total_producto_baja ?? 0), 0);

  if (!responsable) return res.status(400).json({ error: "Responsable invalido" });

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const createdAt = new Date();
        const lowProduct = await tx.productos_baja.create({
          data: {
            id_responsable: responsable.usuario_id,
            fecha_baja: createdAt,
            created_at: createdAt,
            cantida_baja: cantidad_total_baja,
            total_precio_baja,
            nombre_responsable: fullNameFromUser(responsable),
            estado: true,
          },
        });

        for (const p of data.products) {
          const cantidad = Number(p.cantidad ?? 0);
          const totalProductoBaja = Number(p.total_producto_baja ?? 0);

          if (!Number.isFinite(cantidad) || cantidad <= 0) {
            throw new Error(`Cantidad invalida para id_detalle_productos ${p.id_detalle_productos}`);
          }

          // ORIGEN
          const detalle_origen = await tx.detalle_productos.findUnique({
            where: { id_detalle_producto: Number(p.id_detalle_productos) },
            include: { productos: { select: { id_producto: true, nombre: true } } },
          });

          if (!detalle_origen) throw new Error(`No existe detalle_productos con id ${p.id_detalle_productos}`);
          if (!detalle_origen.productos) throw new Error(`No existe producto asociado al detalle ${p.id_detalle_productos}`);

          if (detalle_origen.stock_producto < cantidad) {
            throw new Error(
              `Stock insuficiente en detalle origen #${detalle_origen.id_detalle_producto} (${detalle_origen.stock_producto} < ${cantidad})`
            );
          }

          // Registrar línea de baja
          await tx.detalle_productos_baja.create({
            data: {
              id_baja_productos: lowProduct.id_baja_productos,
              id_detalle_productos: Number(p.id_detalle_productos),
              cantidad,
              motivo: p.motivo,
              total_producto_baja: totalProductoBaja,
              nombre_producto: detalle_origen.productos.nombre,
              estado: true,
            },
          });

          // Descontar stock (baja)
          await tx.detalle_productos.update({
            where: { id_detalle_producto: detalle_origen.id_detalle_producto },
            data: { stock_producto: { decrement: cantidad } },
          });

          await tx.productos.update({
            where: { id_producto: detalle_origen.productos.id_producto },
            data: { stock_actual: { decrement: cantidad } },
          });

          // CONVERSIÓN (venta unitaria)
          if (p.motivo === "venta unitaria") {
            const factor = Number(p.factor_conversion ?? 0);
            const cantDestino = Number(p.cantidad_traslado ?? 0);

            if (!factor || factor <= 0) throw new Error("factor_conversion es requerido y debe ser > 0 para venta unitaria");
            if (!cantDestino || cantDestino <= 0) throw new Error("cantidad_traslado es requerida y debe ser > 0 para venta unitaria");

            let detalle_destino = null;
            let productoCreadoId = null;        // si se creó producto nuevo
            let detalleDestinoCreadoId = null;  // si se creó detalle nuevo

            // Caso A: destino ya existe (me pasan el id)
            const detalle_destino_id = Number(p.id_detalle_destino ?? p.id_producto_traslado ?? 0);
            if (Number.isFinite(detalle_destino_id) && detalle_destino_id > 0) {
              detalle_destino = await tx.detalle_productos.findUnique({
                where: { id_detalle_producto: detalle_destino_id },
                select: { id_detalle_producto: true, id_producto: true },
              });
              if (!detalle_destino) throw new Error(`No existe detalle destino con id ${detalle_destino_id}`);
            } else {
              // Caso B: destino NO existe y se debe crear
              if (!p.crear_destino) {
                throw new Error("Debe enviar id_detalle_destino/id_producto_traslado o crear_destino=true para venta unitaria");
              }

              // B1) Crear producto nuevo (opcional)
              if (p.producto_destino) {
                const pd = p.producto_destino;
                let imageUrl =
                  typeof pd.url_imagen === "string" && pd.url_imagen.trim()
                    ? pd.url_imagen.trim()
                    : null;

                if (
                  !imageUrl &&
                  typeof pd.imagen_base64 === "string" &&
                  pd.imagen_base64.trim()
                ) {
                  try {
                    const uploadResult = await cloudinary.uploader.upload(
                      pd.imagen_base64,
                      { folder: "kajamart/products" }
                    );
                    imageUrl = uploadResult.secure_url;
                  } catch (_err) {
                    throw new Error(
                      "No se pudo subir la imagen del producto destino"
                    );
                  }
                }

                // IMPORTANTE: si manejas codigo_barras único a nivel productos, valida acá.
                // (En tu schema actual, productos.codigo_barras existe pero no lo marcaste unique)
                const nuevoProducto = await tx.productos.create({
                  data: {
                    nombre: pd.nombre,
                    descripcion: pd.descripcion ?? null,
                    stock_actual: 0,
                    stock_minimo: pd.stock_minimo ?? 0,
                    stock_maximo: pd.stock_maximo ?? 0,
                    estado: true,
                    id_categoria: pd.id_categoria,
                    iva: pd.iva ?? null,
                    icu: pd.icu ?? null,
                    porcentaje_incremento: pd.porcentaje_incremento ?? null,
                    costo_unitario: pd.costo_unitario ?? 0,
                    precio_venta: pd.precio_venta ?? 0,
                    url_imagen: imageUrl,
                    cantidad_unitaria: pd.cantidad_unitaria ?? null,
                  },
                  select: { id_producto: true },
                });

                productoCreadoId = nuevoProducto.id_producto;

                // id_producto destino será el producto creado
                p.id_producto_destino = productoCreadoId;
              }

              const idProductoDestino = Number(p.id_producto_destino ?? 0);
              if (!Number.isFinite(idProductoDestino) || idProductoDestino <= 0) {
                throw new Error("Para crear destino debes enviar id_producto_destino o producto_destino (para crear producto).");
              }

              if (!p.codigo_barras_destino) {
                throw new Error("Para crear destino debes enviar codigo_barras_destino (único).");
              }

              const nuevoDetalle = await tx.detalle_productos.create({
                data: {
                  id_producto: idProductoDestino,
                  codigo_barras_producto_compra: String(p.codigo_barras_destino),
                  stock_producto: 0,
                  estado: true,
                  es_devolucion: false,
                  fecha_vencimiento: p.fecha_vencimiento_destino ? new Date(p.fecha_vencimiento_destino) : null,
                },
                select: { id_detalle_producto: true, id_producto: true },
              });

              detalle_destino = nuevoDetalle;
              detalleDestinoCreadoId = nuevoDetalle.id_detalle_producto;
            }

            // Crear cabecera conversión
            const conversion = await tx.conversion_productos.create({
              data: {
                fecha_conversion: new Date(),
                id_responsable: responsable.usuario_id,
                nombre_responsable: fullNameFromUser(responsable),
                estado: true,
                observacion: `Conversion por venta unitaria desde baja #${lowProduct.id_baja_productos}`,
                id_baja_productos: lowProduct.id_baja_productos,

                // ✅ destino del movimiento (siempre)
                productosId_producto: detalle_destino.id_producto,

                // ✅ SOLO si se creó producto nuevo
                id_producto_creado: productoCreadoId,
              },
            });

            // Crear línea conversión (con trazabilidad de detalle creado)
            await tx.detalle_conversion_productos.create({
              data: {
                id_conversion_productos: conversion.id_conversion_productos,
                id_detalle_origen: detalle_origen.id_detalle_producto,
                id_detalle_destino: detalle_destino.id_detalle_producto,
                cantidad_origen: cantidad,
                cantidad_destino: cantDestino,
                factor_conversion: factor,
                estado: true,

                // ✅ SOLO si el detalle destino se creó en esta operación
                id_detalle_destino_creado: detalleDestinoCreadoId,
              },
            });

            // Incrementar destino (y el stock global del destino)
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

        // Respuesta (usa tu include real)
        return tx.productos_baja.findUnique({
          where: { id_baja_productos: lowProduct.id_baja_productos },
          include: lowProductInclude, // <- tu include
        });
      },
      { timeout: 20000 }
    );

    return res.status(201).json(result ? enrichLowProduct(result) : null); // <- tu helper
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message ?? "Error al crear el producto" });
  }
};

const cancelLowProduct = async (req, res) => {
  const { id } = req.params;
  const bajaId = Number(id);
  const LIMIT_MINUTES = 30;

  if (!Number.isFinite(bajaId)) {
    return res.status(400).json({ error: "ID invalido" });
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const baja = await tx.productos_baja.findUnique({
          where: { id_baja_productos: bajaId },
          include: { detalle_productos_baja: true },
        });

        if (!baja) return { ok: false, status: 404, payload: { error: "Baja no encontrada" } };
        if (baja.estado === false) return { ok: false, status: 400, payload: { error: "La baja ya esta anulada" } };

        const createdAt = getLowProductCreatedAt(baja);
        if (!createdAt) {
          return {
            ok: false,
            status: 400,
            payload: {
              error: "La baja no tiene una fecha de creacion valida para anular.",
            },
          };
        }

        const diffMinutes = Math.floor(
          (Date.now() - createdAt.getTime()) / (1000 * 60)
        );
        if (diffMinutes > LIMIT_MINUTES) {
          return {
            ok: false,
            status: 409,
            payload: {
              error:
                `No se puede anular: han pasado ${diffMinutes} minutos desde la creacion de la baja (limite ${LIMIT_MINUTES}).`,
            },
          };
        }

        const conversiones = await tx.conversion_productos.findMany({
          where: { id_baja_productos: bajaId, estado: true },
          include: { detalle_conversion: true },
        });

        const idsConversion = conversiones.map((c) => c.id_conversion_productos);
        const idsProductosCreados = Array.from(
          new Set(
            conversiones
              .map((c) => Number(c.id_producto_creado))
              .filter((x) => Number.isFinite(x) && x > 0)
          )
        );
        const idsDetallesDestinoCreados = Array.from(
          new Set(
            conversiones
              .flatMap((c) =>
                c.detalle_conversion.map((l) => Number(l.id_detalle_destino_creado))
              )
              .filter((x) => Number.isFinite(x) && x > 0)
          )
        );

        // Bloquea anulacion si productos/detalles creados ya estan relacionados
        // con tablas externas a esta baja/conversion.
        if (idsProductosCreados.length || idsDetallesDestinoCreados.length) {
          const whereRelDetalleConversion = {
            OR: [
              { id_detalle_origen: { in: idsDetallesDestinoCreados } },
              { id_detalle_destino: { in: idsDetallesDestinoCreados } },
            ],
          };
          if (idsConversion.length) {
            whereRelDetalleConversion.id_conversion_productos = {
              notIn: idsConversion,
            };
          }

          const whereRelProductoConversion = {
            OR: [
              { id_producto_creado: { in: idsProductosCreados } },
              { productosId_producto: { in: idsProductosCreados } },
            ],
          };
          if (idsConversion.length) {
            whereRelProductoConversion.id_conversion_productos = {
              notIn: idsConversion,
            };
          }

          const [
            relDetalleVenta,
            relDetalleCompra,
            relDetalleBaja,
            relDetalleDevCliente,
            relDetalleFactura,
            relDetalleDevProducto,
            relDetalleConversion,
            relProductoProveedor,
            relProductoDetalleExterno,
            relProductoConversion,
          ] = await Promise.all([
            idsDetallesDestinoCreados.length
              ? tx.detalle_venta.findFirst({
                  where: { id_detalle_producto: { in: idsDetallesDestinoCreados } },
                  select: { id_detalle: true },
                })
              : null,
            idsDetallesDestinoCreados.length
              ? tx.detalle_compra.findFirst({
                  where: { id_detalle_producto: { in: idsDetallesDestinoCreados } },
                  select: { id_detalle: true },
                })
              : null,
            idsDetallesDestinoCreados.length
              ? tx.detalle_productos_baja.findFirst({
                  where: { id_detalle_productos: { in: idsDetallesDestinoCreados } },
                  select: { id_detalle_productos_baja: true },
                })
              : null,
            idsDetallesDestinoCreados.length
              ? tx.devolucion_cliente_entregado.findFirst({
                  where: { id_detalle_producto: { in: idsDetallesDestinoCreados } },
                  select: { id_devolucion_cliente_entregado: true },
                })
              : null,
            idsDetallesDestinoCreados.length
              ? tx.facturas.findFirst({
                  where: { id_detalle_producto: { in: idsDetallesDestinoCreados } },
                  select: { id_factura: true },
                })
              : null,
            idsDetallesDestinoCreados.length
              ? tx.detalle_devolucion_producto.findFirst({
                  where: {
                    OR: [
                      { id_detalle_producto: { in: idsDetallesDestinoCreados } },
                      { id_detalle_producto_creado: { in: idsDetallesDestinoCreados } },
                    ],
                  },
                  select: { id_detalle_devolucion_productos: true },
                })
              : null,
            idsDetallesDestinoCreados.length
              ? tx.detalle_conversion_productos.findFirst({
                  where: whereRelDetalleConversion,
                  select: { id_detalle_conversion: true },
                })
              : null,
            idsProductosCreados.length
              ? tx.producto_proveedor.findFirst({
                  where: { id_producto: { in: idsProductosCreados } },
                  select: { id_producto_proveedor: true },
                })
              : null,
            idsProductosCreados.length
              ? tx.detalle_productos.findFirst({
                  where: {
                    id_producto: { in: idsProductosCreados },
                    id_detalle_producto: { notIn: idsDetallesDestinoCreados },
                  },
                  select: { id_detalle_producto: true },
                })
              : null,
            idsProductosCreados.length
              ? tx.conversion_productos.findFirst({
                  where: whereRelProductoConversion,
                  select: { id_conversion_productos: true },
                })
              : null,
          ]);

          const tablasDetalleRelacionadas = [];
          if (relDetalleVenta) tablasDetalleRelacionadas.push("detalle_venta");
          if (relDetalleCompra) tablasDetalleRelacionadas.push("detalle_compra");
          if (relDetalleBaja) tablasDetalleRelacionadas.push("detalle_productos_baja");
          if (relDetalleDevCliente)
            tablasDetalleRelacionadas.push("devolucion_cliente_entregado");
          if (relDetalleFactura) tablasDetalleRelacionadas.push("facturas");
          if (relDetalleDevProducto)
            tablasDetalleRelacionadas.push("detalle_devolucion_producto");
          if (relDetalleConversion)
            tablasDetalleRelacionadas.push("detalle_conversion_productos");

          const tablasProductoRelacionadas = [];
          if (relProductoProveedor) tablasProductoRelacionadas.push("producto_proveedor");
          if (relProductoDetalleExterno)
            tablasProductoRelacionadas.push("detalle_productos");
          if (relProductoConversion)
            tablasProductoRelacionadas.push("conversion_productos");

          if (tablasDetalleRelacionadas.length || tablasProductoRelacionadas.length) {
            return {
              ok: false,
              status: 409,
              payload: {
                error:
                  "No se puede anular debido que los productos estan siendo usados.",
                ids_producto: idsProductosCreados,
                ids_detalle_producto: idsDetallesDestinoCreados,
                tablas_producto_relacionadas: tablasProductoRelacionadas,
                tablas_detalle_relacionadas: tablasDetalleRelacionadas,
              },
            };
          }
        }

        // IDs involucrados (baja + conversión)
        const idsDetalleBaja = baja.detalle_productos_baja
          .map((d) => d.id_detalle_productos)
          .filter((x) => Number.isFinite(x));

        const idsDetalleConv = [];
        for (const conv of conversiones) {
          for (const l of conv.detalle_conversion) {
            idsDetalleConv.push(l.id_detalle_origen, l.id_detalle_destino);
            if (Number.isFinite(l.id_detalle_destino_creado)) {
              idsDetalleConv.push(l.id_detalle_destino_creado);
            }
          }
        }

        const allDetalleIds = Array.from(new Set([...idsDetalleBaja, ...idsDetalleConv].filter(Number.isFinite)));

        const detalles = await tx.detalle_productos.findMany({
          where: { id_detalle_producto: { in: allDetalleIds } },
          select: { id_detalle_producto: true, id_producto: true, stock_producto: true },
        });

        const detalleMap = new Map(detalles.map((d) => [d.id_detalle_producto, d]));
        for (const detId of allDetalleIds) {
          if (!detalleMap.has(detId)) {
            return {
              ok: false,
              status: 409,
              payload: { error: `Inconsistencia: no existe detalle_productos con id ${detId}` },
            };
          }
        }

        // Deltas de rollback
        const deltaDetalleInc = new Map(); // origen + (revierte baja y revierte conversión origen)
        const deltaDetalleDec = new Map(); // destino - (revierte conversión destino)
        const deltaProductoInc = new Map();
        const deltaProductoDec = new Map();
        const addTo = (m, key, val) => m.set(key, (m.get(key) ?? 0) + val);

        // Revertir baja: lo bajado vuelve
        for (const d of baja.detalle_productos_baja) {
          const detId = Number(d.id_detalle_productos);
          const cant = Number(d.cantidad ?? 0);
          if (!Number.isFinite(detId) || !Number.isFinite(cant) || cant <= 0) continue;

          const det = detalleMap.get(detId);
          addTo(deltaDetalleInc, detId, cant);
          addTo(deltaProductoInc, det.id_producto, cant);
        }

        // Revertir conversiones (venta unitaria): origen vuelve, destino se quita
        for (const conv of conversiones) {
          for (const l of conv.detalle_conversion) {
            const origenId = Number(l.id_detalle_origen);
            const destinoId = Number(l.id_detalle_destino);
            const cantOrigen = Number(l.cantidad_origen ?? 0);
            const cantDestino = Number(l.cantidad_destino ?? 0);

            if (!Number.isFinite(origenId) || !Number.isFinite(destinoId)) continue;
            if (!Number.isFinite(cantOrigen) || !Number.isFinite(cantDestino)) continue;
            if (cantOrigen <= 0 || cantDestino <= 0) continue;

            const detOrigen = detalleMap.get(origenId);
            const detDestino = detalleMap.get(destinoId);

            addTo(deltaDetalleInc, origenId, cantOrigen);
            addTo(deltaProductoInc, detOrigen.id_producto, cantOrigen);

            addTo(deltaDetalleDec, destinoId, cantDestino);
            addTo(deltaProductoDec, detDestino.id_producto, cantDestino);
          }
        }

        // Validación anti-negativo: destino debe tener stock suficiente para decrementar
        const productoIdsDestino = Array.from(deltaProductoDec.keys());
        const productosDestino = await tx.productos.findMany({
          where: { id_producto: { in: productoIdsDestino } },
          select: { id_producto: true, stock_actual: true },
        });
        const productoMap = new Map(productosDestino.map((p) => [p.id_producto, p]));

        for (const [detalleId, dec] of deltaDetalleDec.entries()) {
          const det = detalleMap.get(detalleId);
          if (det.stock_producto < dec) {
            return {
              ok: false,
              status: 409,
              payload: {
                error:
                  `No se puede anular: el detalle destino #${detalleId} no tiene stock suficiente ` +
                  `para revertir (${det.stock_producto} < ${dec}). Probablemente ya se vendieron/consumieron unidades.`,
              },
            };
          }
        }

        for (const [prodId, dec] of deltaProductoDec.entries()) {
          const prod = productoMap.get(prodId);
          if (!prod) {
            return { ok: false, status: 409, payload: { error: `Inconsistencia: no existe producto destino #${prodId}` } };
          }
          if (prod.stock_actual < dec) {
            return {
              ok: false,
              status: 409,
              payload: { error: `No se puede anular: el producto destino #${prodId} no tiene stock suficiente (${prod.stock_actual} < ${dec}).` },
            };
          }
        }

        // 1) Anular cabecera baja
        await tx.productos_baja.update({
          where: { id_baja_productos: bajaId },
          data: { estado: false },
        });

        // ✅ 2) Anular líneas de baja (te faltaba)
        await tx.detalle_productos_baja.updateMany({
          where: { id_baja_productos: bajaId },
          data: { estado: false },
        });

        // 3) Rollback stock detalle
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

        // 4) Rollback stock global
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

        // 5) Anular conversiones y líneas
        const idsLineas = conversiones.flatMap((c) => c.detalle_conversion.map((l) => l.id_detalle_conversion));

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

        // 6) Soft delete PRODUCTOS creados (solo los realmente creados)

        if (idsProductosCreados.length) {
          // si algún detalle de esos productos fue vendido, NO se elimina
          const detallesCreados = await tx.detalle_productos.findMany({
            where: { id_producto: { in: idsProductosCreados } },
            select: { id_detalle_producto: true, id_producto: true },
          });

          const idsDetallesCreados = detallesCreados.map((d) => d.id_detalle_producto);

          const ventasUsos = idsDetallesCreados.length
            ? await tx.detalle_venta.findMany({
                where: { id_detalle_producto: { in: idsDetallesCreados } },
                select: { id_detalle_producto: true },
              })
            : [];

          const usadosDetalle = new Set(ventasUsos.map((v) => v.id_detalle_producto));
          const usadosProducto = new Set(
            detallesCreados.filter((d) => usadosDetalle.has(d.id_detalle_producto)).map((d) => d.id_producto)
          );

          const noUsados = Array.from(new Set(idsProductosCreados)).filter((pid) => !usadosProducto.has(pid));

          if (noUsados.length) {
            await tx.productos.updateMany({
              where: { id_producto: { in: noUsados } },
              data: { estado: false },
            });
          }
        }

        // 7) Soft delete DETALLES creados (nuevo)

        if (idsDetallesDestinoCreados.length) {
          const usos = await tx.detalle_venta.findMany({
            where: { id_detalle_producto: { in: idsDetallesDestinoCreados } },
            select: { id_detalle_producto: true },
          });

          const usados = new Set(usos.map((u) => u.id_detalle_producto));
          const noUsados = idsDetallesDestinoCreados.filter((id) => !usados.has(id));

          if (noUsados.length) {
            await tx.detalle_productos.updateMany({
              where: { id_detalle_producto: { in: noUsados } },
              data: { estado: false, stock_producto: 0 },
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
      return res.status(result.status).json(result.payload ? enrichLowProduct(result.payload) : null);
    }
    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message ?? "Error al anular la baja" });
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
  getAllLowProducts
};
