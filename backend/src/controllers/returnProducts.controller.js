const prisma = require("../prisma/prismaClient");

const getReturnProducts = async (req, res) => {
  try {
    const returnProducts = await prisma.devolucion_producto.findMany({
      include: { detalle_devolucion_producto: true },
    });
    return res.status(200).json({ returnProducts });
  } catch (error) {
    return res.status(500).json({ error: "Error al obtener los productos" });
  }
};

const getOneReturnProdcts = async (req, res) => {
  const { q } = req.query;
  const isNumber = !isNaN(q);
  console.log(q);
  const filter = isNumber
  ?{
    OR:[
    {id_devolucion_product: {equals: Number(q)}},
    {fecha_devolucion: {contains: q}},
    {cantidad_total:{equals: Number(q)}},
    {detalle_devolucion_producto:{
      some:{
        OR:[{
          cantidad_devuelta:{equals: Number(q)}
        }]
      }
    }}
    ]
  }
  :{
    OR:[{
      nombre_responsable:{contains: q, mode: "insensitive"}
    },
    {OR:[{
      detalle_devolucion_producto:{
        some:{
          OR:[{
            nombre_producto:{contains: q, mode: "insensitive"},
          },
          {
            motivo:{contains: q, mode: "insensitive"}
          }
        ]
        }
      }
    }]}
  ]
  }
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

module.exports = {
  getReturnProducts,
  getOneReturnProdcts,
};
