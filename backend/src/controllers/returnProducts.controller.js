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
      include: {
        detalle_devolucion_producto: {
          include:{
            detalle_productos:{
              include:{
                productos:{
                  include:{
                    producto_proveedor:{
                      include:{
                        proveedores:true
                      }
                    }
                  }
                }
              }
            }
          }
        },
      },
    });
    return res.status(200).json({ returnProducts });
  } catch (error) {
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
  const responsable = await getResponsable(data.id_responsable);
  const cantidadTotal = data.products.reduce((acc, p) => acc + p.cantidad, 0);
  if (responsable) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const returnProduct = await tx.devolucion_producto.create({
          data: {
            id_responsable: responsable.usuario_id,
            numero_factura: data.numero_factura,
            fecha_devolucion: new Date(),
            cantidad_total: cantidadTotal,
            nombre_responsable: responsable.nombre,
          },
        });
        for (const p of data.products) {
          const detailReturnProduct =
            await tx.detalle_devolucion_producto.create({
              data: {
                id_devolucion_producto: returnProduct.id_devolucion_product,
                id_detalle_producto: p.id_detalle_producto,
                cantidad_devuelta: p.cantidad,
                motivo: p.motivo,
                nombre_producto: p.nombre_producto,
                es_descuento: p.es_descuento,
              },
            });
          await tx.detalle_productos.update({
            where: {
              id_detalle_producto: p.id_detalle_producto,
            },
            data: {
              stock_producto: {
                decrement: p.cantidad,
              },
            },
          });
          const detalleProduct = await tx.detalle_productos.findUnique({
            where: {
              id_detalle_producto: p.id_detalle_producto,
            },
          });
          await tx.productos.update({
            where: {
              id_producto: detalleProduct.id_producto,
            },
            data: {
              stock_actual: {
                decrement: p.cantidad,
              },
            },
          });
        }
        return await tx.devolucion_producto.findUnique({
          where: {
            id_devolucion_product: returnProduct.id_devolucion_product,
          },
          include: {
            detalle_devolucion_producto: true,
          },
        });
      });
      console.log("se hizo el post");
      return res.status(201).json(result);
    } catch (error) {
      return res.status(500).json({ error: "Error al crear el producto" });
    }
  }
};

module.exports = {
  getReturnProducts,
  searchReturnProdcts,
  createReturnProduct,
};
