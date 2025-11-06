const prisma = require("../prisma/prismaClient");

const createDetailProduct = async (req, res) => {
  const data = req.body;
  try {
    const register = await prisma.$transaction(async (tx) => {
      const detailProduct = await tx.detalle_productos.create({
        data: {
          id_producto: data.id_producto,
          codigo_barras_producto_compra: data.codigo_barras,
          fecha_vencimiento: data.fecha_vencimiento
            ? new Date(data.fecha_vencimiento)
            : null,
          stock_producto: data.stock_producto,
          es_devolucion: true,
        },
      });
      await tx.productos.update({
        where: {
          id_producto: data.id_producto,
        },
        data: {
          stock_actual: {
            increment: data.stock_producto,
          },
        },
      });
      return detailProduct;
    });
    return res.status(201).json(register);
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Error al crear el detalle del producto" });
  }
};

module.exports = {
  createDetailProduct,
};
