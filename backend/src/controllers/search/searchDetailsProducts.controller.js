const prisma = require("../../prisma/prismaClient");

const searchDetailsProducts = async (req, res) => {
  const q = String(req.params.q).trim();
  console.log(q);
  try {
    const detailsProducts = await prisma.detalle_productos.findMany({
      where: {
        OR: [
          {
            codigo_barras_producto_compra: { contains: q, mode: "insensitive" },
          },
          {
            productos: { is: { nombre: { contains: q, mode: "insensitive" } } },
          },
        ],
      },
      include: { productos: true },
    });
    if (detailsProducts) {
      return res.status(200).json(detailsProducts);
    } else {
      return res.status(404).json({ error: "No se encontro ningun producto" });
    }
  } catch (error) {
    return res.status(500).json({ error: "Error al buscar los productos" });
  }
};

module.exports = {
  searchDetailsProducts,
};
