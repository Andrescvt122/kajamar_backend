const prisma = require("../prisma/prismaClient");
const { getResponsable } = require("./returnProducts.controller");

const getReturnClients = async (req, res) => {
  try {
    const returnClients = await prisma.devolucion_cliente.findMany({
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
                    productos: true,
                  },
                },
              },
            },
          },
        },
        devolucion_cliente_entregado: {
          include: {
            detalle_producto: {
              include: {
                productos: true,
              },
            },
          },
        },
        usuarios: true,
      },
    });
    return res.status(200).json({ returnClients });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Error al obtener las devoluciones a clientes" });
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
        const devolucionCliente = await tx.devolucion_cliente.create({
          data: {
            id_venta: Number(data.id_venta),
            id_responsable: responsable.usuario_id,
            fecha_devolucion: new Date(),
            valor_devolucion_total: data.valor_devolucion_total,
            cantidad_devuelta_a_cliente: cantidadTotalAEntregar,
            cantidad_devuelta_cliente: cantidadTotalDeCliente,
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
              const detalle_producto = await tx.detalle_productos.findUnique({
                where: {
                  id_detalle_producto: detalleVenta.id_detalle_producto,
                },
                include: { productos: true },
              });

              const bajaProducto = await tx.productos_baja.create({
                data: {
                  id_responsable: responsable.usuario_id,
                  fecha_baja: new Date(),
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

module.exports = {
  getReturnClients,
};
