const prisma = require("../prisma/prismaClient");
const { getResponsable } = require("./returnProducts.controller");

function getReturnClientCreatedAt(devolucion) {
  const createdAt = devolucion?.created_at
    ? new Date(devolucion.created_at)
    : devolucion?.fecha_devolucion
    ? new Date(devolucion.fecha_devolucion)
    : null;

  if (!createdAt || Number.isNaN(createdAt.getTime())) return null;
  return createdAt;
}

const getAllReturnClients = async (req, res) => {
  try {
    const returnClients = await prisma.devolucion_cliente.findMany({
      include: {
        ventas: {
          select: {
            id_venta: true,
            clientes: {
              select: {
                id_cliente: true,
                nombre_cliente: true,
              },
            },
          },
        },
        devolucion_cliente_devuelto: {
          include: {
            detalle_venta: {
              select: {
                id_detalle: true,
                detalle_productos: {
                  select: {
                    id_detalle_producto: true,
                    productos: {
                      select: {
                        id_producto: true,
                        nombre: true,
                        producto_proveedor: {
                          select: {
                            id_producto_proveedor: true,
                            proveedores: {
                              select: {
                                id_proveedor: true,
                                nombre: true,
                              },
                            },
                          },
                        },
                        categorias: {
                          select: {
                            id_categoria: true,
                            nombre_categoria: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        devolucion_cliente_entregado: {
          include: {
            detalle_productos: {
              select: {
                id_detalle_producto: true,
                productos: {
                  select: {
                    id_producto: true,
                    nombre: true,
                    producto_proveedor: {
                      select: {
                        id_producto_proveedor: true,
                        proveedores: {
                          select: {
                            id_proveedor: true,
                            nombre: true,
                          },
                        },
                      },
                    },
                    categorias: {
                      select: {
                        id_categoria: true,
                        nombre_categoria: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        usuarios: {
          select: {
            usuario_id: true,
            nombre: true,
            apellido: true,
          },
        },
      },
      orderBy: { id_devoluciones_cliente: "desc" },
    });

    return res.status(200).json({ data: returnClients });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Error al obtener las devoluciones a clientes" });
  }
};

const getReturnClients = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 6, 1), 20);
    const skip = (page - 1) * limit;

    const [data, totalItems] = await Promise.all([
      prisma.devolucion_cliente.findMany({
        skip,
        take: limit,
        orderBy: { id_devoluciones_cliente: "desc" },
        include: {
          ventas: {
            include: {
              clientes: true,
            },
          },
          devolucion_cliente_devuelto: {
            include: {
              detalle_venta: {
                include: {
                  detalle_productos: {
                    include: {
                      productos: {
                        select: {
                          nombre: true,
                          id_producto: true,
                          categorias: {
                            select: {
                              id_categoria: true,
                              nombre_categoria: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          devolucion_cliente_entregado: {
            include: {
              detalle_productos: {
                include: {
                  productos: true,
                },
              },
            },
          },
          usuarios: true,
        },
      }),
      prisma.devolucion_cliente.count(),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    return res.status(200).json({
      data,
      meta: {
        page,
        limit,
        totalItems,
        totalPages,
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Error al obtener las devoluciones a clientes" });
  }
};

const searchReturnClients = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) {
      return res.status(200).json({ data: [] });
    }

    const numericId = Number(q);
    const isNumeric = !Number.isNaN(numericId);

    const returnClients = await prisma.devolucion_cliente.findMany({
      where: {
        OR: [
          ...(isNumeric
            ? [
                { id_devoluciones_cliente: numericId },
                { id_venta: numericId },
              ]
            : []),
          {
            ventas: {
              is: {
                clientes: {
                  is: {
                    nombre_cliente: {
                      contains: q,
                      mode: "insensitive",
                    },
                  },
                },
              },
            },
          },
          {
            usuarios: {
              is: {
                OR: [
                  {
                    nombre: {
                      contains: q,
                      mode: "insensitive",
                    },
                  },
                  {
                    apellido: {
                      contains: q,
                      mode: "insensitive",
                    },
                  },
                ],
              },
            },
          },
          {
            devolucion_cliente_devuelto: {
              some: {
                OR: [
                  {
                    motivo: {
                      contains: q,
                      mode: "insensitive",
                    },
                  },
                  {
                    detalle_venta: {
                      is: {
                        detalle_productos: {
                          is: {
                            productos: {
                              is: {
                                nombre: {
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
          {
            devolucion_cliente_entregado: {
              some: {
                detalle_productos: {
                  is: {
                    productos: {
                      is: {
                        nombre: {
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
      include: {
        ventas: {
          include: {
            clientes: true,
          },
        },
        devolucion_cliente_devuelto: {
          include: {
            detalle_venta: {
              include: {
                detalle_productos: {
                  include: {
                    productos: {
                      select: {
                        nombre: true,
                        id_producto: true,
                        categorias: {
                          select: {
                            id_categoria: true,
                            nombre_categoria: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        devolucion_cliente_entregado: {
          include: {
            detalle_productos: {
              include: {
                productos: true,
              },
            },
          },
        },
        usuarios: true,
      },
      orderBy: { id_devoluciones_cliente: "desc" },
    });

    return res.status(200).json({ data: returnClients });
  } catch (error) {
    console.error("❌ Error al buscar devoluciones de clientes:", error);
    return res
      .status(500)
      .json({ error: "Error al buscar las devoluciones a clientes" });
  }
};

const createReturnClients = async (req, res) => {
  const data = req.body;
  const responsable = await getResponsable(Number(data.id_responsable));
  if (!responsable)
    return res.status(404).json({ error: "Responsable no encontrado" });
  const venta = await prisma.ventas.findUnique({
    where: {
      id_venta: Number(data.id_venta),
    },
    include: {
      detalle_venta: true,
    },
  });
  if (!venta) {
    return res.status(404).json({ error: "Venta no encontrada o no existe" });
  }
  // validar que los productos a devolver existan en la venta
  const idsDetalleVenta = new Set(
    venta.detalle_venta.map((dv) => dv.id_detalle),
  );
  const productosEnVenta = data.productosVenta.every((pv) =>
    idsDetalleVenta.has(pv.id_detalle_venta),
  );

  if (!productosEnVenta) {
    return res
      .status(400)
      .json({ error: "Uno o mas productos a devolver no existen en la venta" });
  }
  const disponibilidadDevolucion = await prisma.ventas.findFirst({
    where: {
      id_venta: Number(data.id_venta),
    },
    select: {
      dispo_devolucion: true,
    },
  });
  if (!disponibilidadDevolucion?.dispo_devolucion) {
    return res
      .status(400)
      .json({ error: "La venta no tiene disponible devoluciones" });
  }
  if (responsable && productosEnVenta) {
    try {
      const cantidadTotalDeCliente = data.productosVenta.reduce(
        (acc, p) => acc + p.cantidad,
        0,
      );
      const cantidadTotalAEntregar = data.productosEntrega.reduce(
        (acc, p) => acc + p.cantidad,
        0,
      );
      const registro = await prisma.$transaction(async (tx) => {
        const createdAt = new Date();
        const devolucionCliente = await tx.devolucion_cliente.create({
          data: {
            id_venta: Number(data.id_venta),
            id_responsable: responsable.usuario_id,
            fecha_devolucion: createdAt,
            created_at: createdAt,
            total_devolucion_producto: data.total_devolucion_producto,
            total_devolucion_cliente: data.total_devolucion_cliente,
            cantidad_devuelta_a_cliente: cantidadTotalAEntregar,
            cantidad_devuelta_cliente: cantidadTotalDeCliente,
          },
        });
        await tx.ventas.update({
          where: {
            id_venta: Number(data.id_venta),
          },
          data: {
            dispo_devolucion: false,
          },
        });
        const devolucionDevueltoPromesa = data.productosVenta.map(
          async (pv) => {
            const condicion = String(pv.condicion || "").toLowerCase();

            // siempre creas el registro devuelto
            const devuelto = await tx.devolucion_cliente_devuelto.create({
              data: {
                id_devolucion_cliente:
                  devolucionCliente.id_devoluciones_cliente,
                id_detalle_venta: pv.id_detalle_venta,
                cantidad_cliente_devuelto: pv.cantidad,
                motivo: pv.motivo,
                valor_unitario: pv.valor_unitario,
                condicion_producto: pv.condicion,
              },
            });
            const detalleVenta = await tx.detalle_venta.findUnique({
              where: { id_detalle: pv.id_detalle_venta },
              include: { detalle_productos: true },
            });
            if (condicion === "dañado") {
              const lowCreatedAt = new Date();
              const detalle_producto = await tx.detalle_productos.findUnique({
                where: {
                  id_detalle_producto: detalleVenta.id_detalle_producto,
                },
                include: { productos: true },
              });

              const bajaProducto = await tx.productos_baja.create({
                data: {
                  id_responsable: responsable.usuario_id,
                  desde_dev_cliente: devolucionCliente.id_devoluciones_cliente,
                  fecha_baja: lowCreatedAt,
                  created_at: lowCreatedAt,
                  cantida_baja: pv.cantidad,
                  total_precio_baja: pv.valor_unitario * pv.cantidad,
                  nombre_responsable: `${responsable.nombre} ${responsable.apellido}`,
                },
              });

              await tx.detalle_productos_baja.create({
                data: {
                  id_baja_productos: bajaProducto.id_baja_productos, // OJO: en schema el campo es id_baja_productos
                  id_detalle_productos: detalleVenta.id_detalle_producto, // OJO: en schema es id_detalle_productos
                  cantidad: pv.cantidad,
                  motivo: pv.condicion,
                  total_producto_baja: pv.valor_unitario * pv.cantidad,
                  nombre_producto: detalle_producto?.productos?.nombre ?? null,
                },
              });
            }
            if (condicion === "bueno" || condicion === "vencido") {
              const reStockDetalleProducto = await tx.detalle_productos.update({
                where: {
                  id_detalle_producto: detalleVenta.id_detalle_producto,
                },
                data: {
                  stock_producto: { increment: pv.cantidad },
                },
              });
              const reStockProducto = await tx.productos.update({
                where: {
                  id_producto: reStockDetalleProducto.id_producto,
                },
                data: {
                  stock_actual: { increment: pv.cantidad },
                },
              });
            }
            return devuelto;
          },
        );

        const devolucionEntregadoPromesa = data.productosEntrega.map(
          async (pe) => {
            const entregado = await tx.devolucion_cliente_entregado.create({
              data: {
                id_devolucion_cliente:
                  devolucionCliente.id_devoluciones_cliente,
                id_detalle_producto: pe.id_detalle_producto,
                cantidad_entregada: pe.cantidad, // nombre real
                valor_unitario: pe.valor_unitario,
              },
            });

            const detalleProducto = await tx.detalle_productos.update({
              where: { id_detalle_producto: pe.id_detalle_producto },
              data: { stock_producto: { decrement: pe.cantidad } }, // nombre real
            });

            await tx.productos.update({
              where: { id_producto: detalleProducto.id_producto },
              data: { stock_actual: { decrement: pe.cantidad } },
            });

            return entregado;
          },
        );

        const [devolucionDevueltoResults, devolucionEntregadoResults] =
          await Promise.all([
            Promise.all(devolucionDevueltoPromesa),
            Promise.all(devolucionEntregadoPromesa),
          ]);

        return {
          devolucionCliente,
          devolucionDevueltoResults,
          devolucionEntregadoResults,
        };
      });

      return res
        .status(201)
        .json({ message: "Devolucion al cliente registrada con exito" });
    } catch (error) {
      return res
        .status(500)
        .json({ error: "Error al procesar la devolucion al cliente" });
    }
  }
};

const cancelReturnClient = async (req, res) => {
  const data = req.body ?? {};
  const id_devolucion_cliente = Number(
    req.params.id ?? data.id_devolucion_cliente,
  );
  const LIMIT_MINUTES = 30;

  if (!Number.isFinite(id_devolucion_cliente)) {
    return res.status(400).json({ error: "ID de devolucion invalido" });
  }

  const responsable = await getResponsable(Number(data.id_responsable));
  if (!responsable) {
    return res.status(404).json({ error: "Responsable no encontrado" });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const devolucion = await tx.devolucion_cliente.findUnique({
        where: { id_devoluciones_cliente: id_devolucion_cliente },
        select: {
          id_devoluciones_cliente: true,
          id_venta: true,
          estado: true,
          created_at: true,
          fecha_devolucion: true,
        },
      });

      if (!devolucion) {
        return {
          ok: false,
          status: 404,
          payload: { error: "Devolucion al cliente no encontrada" },
        };
      }

      if (devolucion.estado === false) {
        return {
          ok: false,
          status: 400,
          payload: { error: "La devolucion al cliente ya esta anulada" },
        };
      }

      const createdAt = getReturnClientCreatedAt(devolucion);
      if (!createdAt) {
        return {
          ok: false,
          status: 400,
          payload: {
            error:
              "La devolucion al cliente no tiene una fecha de creacion valida para anular.",
          },
        };
      }

      const diffMinutes = Math.floor(
        (Date.now() - createdAt.getTime()) / (1000 * 60),
      );
      if (diffMinutes > LIMIT_MINUTES) {
        return {
          ok: false,
          status: 409,
          payload: {
            error:
              `No se puede anular: han pasado ${diffMinutes} minutos desde la creacion de la devolucion al cliente (limite ${LIMIT_MINUTES}).`,
          },
        };
      }

      const [productosDevueltos, productosEntregados] = await Promise.all([
        tx.devolucion_cliente_devuelto.findMany({
          where: {
            id_devolucion_cliente: id_devolucion_cliente,
            estado: { not: false },
          },
          include: {
            detalle_venta: {
              include: {
                detalle_productos: {
                  include: {
                    productos: true,
                  },
                },
              },
            },
          },
        }),
        tx.devolucion_cliente_entregado.findMany({
          where: {
            id_devolucion_cliente: id_devolucion_cliente,
            estado: { not: false },
          },
          include: {
            detalle_productos: {
              include: {
                productos: true,
              },
            },
          },
        }),
      ]);

      await tx.devolucion_cliente.update({
        where: { id_devoluciones_cliente: id_devolucion_cliente },
        data: {
          estado: false,
          usuarios: { connect: { usuario_id: responsable.usuario_id } },
        },
      });

      if (Number.isFinite(Number(devolucion.id_venta))) {
        await tx.ventas.update({
          where: { id_venta: Number(devolucion.id_venta) },
          data: { dispo_devolucion: true },
        });
      }

      await tx.devolucion_cliente_devuelto.updateMany({
        where: { id_devolucion_cliente: id_devolucion_cliente },
        data: { estado: false },
      });

      await tx.devolucion_cliente_entregado.updateMany({
        where: { id_devolucion_cliente: id_devolucion_cliente },
        data: { estado: false },
      });

      const normalize = (value) =>
        String(value ?? "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");

      for (const p of productosDevueltos) {
        const motivo = normalize(p.motivo);
        const revierteStockDevuelto =
          motivo.includes("incorrecto") ||
          motivo.includes("no requerido") ||
          motivo.includes("vencido");

        if (!revierteStockDevuelto) continue;

        const detalleId = Number(
          p?.detalle_venta?.detalle_productos?.id_detalle_producto,
        );
        const productoId = Number(
          p?.detalle_venta?.detalle_productos?.productos?.id_producto,
        );
        const cantidad = Number(p.cantidad_cliente_devuelto ?? 0);

        if (
          !Number.isFinite(detalleId) ||
          !Number.isFinite(productoId) ||
          !Number.isFinite(cantidad) ||
          cantidad <= 0
        ) {
          continue;
        }

        await tx.detalle_productos.update({
          where: { id_detalle_producto: detalleId },
          data: { stock_producto: { decrement: cantidad } },
        });

        await tx.productos.update({
          where: { id_producto: productoId },
          data: { stock_actual: { decrement: cantidad } },
        });
      }

      const huboDanados = productosDevueltos.some((p) =>
        normalize(p.motivo).includes("danado"),
      );

      if (huboDanados) {
        const bajas = await tx.productos_baja.findMany({
          where: { desde_dev_cliente: id_devolucion_cliente },
          select: { id_baja_productos: true },
        });

        const idsBaja = bajas
          .map((b) => Number(b.id_baja_productos))
          .filter((x) => Number.isFinite(x));

        if (idsBaja.length) {
          await tx.detalle_productos_baja.deleteMany({
            where: { id_baja_productos: { in: idsBaja } },
          });

          await tx.productos_baja.deleteMany({
            where: { id_baja_productos: { in: idsBaja } },
          });
        }
      }

      for (const p of productosEntregados) {
        const detalleId = Number(p?.detalle_productos?.id_detalle_producto);
        const productoId = Number(p?.detalle_productos?.productos?.id_producto);
        const cantidad = Number(p.cantidad_entregada ?? 0);

        if (
          !Number.isFinite(detalleId) ||
          !Number.isFinite(productoId) ||
          !Number.isFinite(cantidad) ||
          cantidad <= 0
        ) {
          continue;
        }

        await tx.detalle_productos.update({
          where: { id_detalle_producto: detalleId },
          data: { stock_producto: { increment: cantidad } },
        });

        await tx.productos.update({
          where: { id_producto: productoId },
          data: { stock_actual: { increment: cantidad } },
        });
      }

      return {
        ok: true,
        status: 200,
        payload: { message: "Devolucion al cliente anulada con exito" },
      };
    });

    return res.status(result.status).json(result.payload);
  } catch (error) {
    console.error("Error al anular la devolucion al cliente:", error);
    return res
      .status(500)
      .json({ error: "Error al anular la devolucion al cliente" });
  }
};

const anularReturnClient = cancelReturnClient;

module.exports = {
  getReturnClients,
  createReturnClients,
  cancelReturnClient,
  anularReturnClient,
  getAllReturnClients,
  searchReturnClients,
};
