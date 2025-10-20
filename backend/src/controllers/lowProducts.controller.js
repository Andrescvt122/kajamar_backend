const prisma = require("../prisma/prismaClient");

const getLowProducts = async (req, res) => {
  try {
    const lowProducts = await prisma.productos_baja.findMany({
      include: { detalle_productos_baja: true },
    });
    return res.status(200).json(lowProducts);
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
      include: {
        detalle_productos_baja: true,
      },
    });
    return res.status(200).json(lowProduct);
  } catch (error) {
    return res.status(500).json({ error: "Error al obtener el producto" });
  }
};
const searchLowProduct = async (req, res) => {
  const { q } = req.query;

  try {
    // Detecta si el valor es número o texto
    const isNumber = !isNaN(q);

    // Construye condiciones dinámicas según tipo
    const filter = isNumber
      ? {
          OR: [
            { id_baja_productos: { equals: Number(q) } },
            { cantida_baja: { equals: Number(q) } },
            { total_precio_baja: { equals: q } }, // si es string en la BD
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

    // Ejecutar búsqueda
    const lowProducts = await prisma.productos_baja.findMany({
      where: filter,
      include: {
        detalle_productos_baja: true,
      },
    });

    return res.status(200).json(lowProducts);
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
  const data = req.body;
  const responsable = await getResponsable(data.id_responsable);
  const cantidad_total_baja = data.products.reduce(
    (acc, p) => acc + p.cantidad,
    0
  );
  const total_precio_baja = data.products.reduce(
    (acc, p) => acc + p.total_producto_baja,
    0
  );
  if (responsable) {
    try {
      // cabecera
      const result = await prisma.$transaction(async (tx) => {
        const lowProduct = await tx.productos_baja.create({
          data: {
            id_responsable: responsable.usuario_id,
            fecha_baja: new Date(),
            cantida_baja: cantidad_total_baja,
            total_precio_baja: total_precio_baja,
            nombre_responsable: responsable.nombre,
          },
        });
        // detalle
        for (const p of data.products) {
          const detalle_producto = await tx.detalle_productos.findUnique({
            where: {
              id_detalle_producto: p.id_detalle_productos,
            },
          });
          const product = await tx.productos.findUnique({
            where: {
              id_producto: detalle_producto.id_producto,
            },
          });
          const detalle = await tx.detalle_productos_baja.create({
            data: {
              id_baja_productos: lowProduct.id_baja_productos,
              id_detalle_productos: p.id_detalle_productos,
              cantidad: p.cantidad,
              motivo: p.motivo,
              total_producto_baja: p.total_producto_baja,
              nombre_producto: product.nombre,
            },
          });
          await tx.detalle_productos.update({
            where: {
              id_detalle_producto: p.id_detalle_productos,
            },
            data: {
              stock_producto: {
                decrement: p.cantidad,
              },
            },
          });
          const detalleProduct = await tx.detalle_productos.findUnique({
            where: {
              id_detalle_producto: p.id_detalle_productos,
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
        // retornar todo
        return await tx.productos_baja.findUnique({
          where: {
            id_baja_productos: lowProduct.id_baja_productos,
          },
          include: {
            detalle_productos_baja: true,
          },
        });
      });
      return res.status(201).json(result);
    } catch (error) {
      return res.status(500).json({ error: "Error al crear el producto" });
    }
  }
};

module.exports = {
  getLowProducts,
  createLowProduct,
  searchLowProduct,
  getOneLowProduct,
};
