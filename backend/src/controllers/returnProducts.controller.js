const prisma = require("../prisma/prismaClient");

const getReturnProducts = async (req, res) => {
  try {
    const returnProducts = await prisma.devolucion_producto.findMany({
      include: { detalle_devolucion_producto: true }
    });
    return res.status(200).json({returnProducts});
  } catch (error) {
    return res.status(500).json({ error: "Error al obtener los productos" });
  }
};

const getOneReturnProdcts = async (req, res) =>{
    const {id} = req.query;
    try{
        const returnProducts = await prisma.devolucion_producto.findMany({
            where: {
                OR:[
                    {
                        id_devolucion_productos: Number(id)
                    },
                    {

                    }
                ]

            }
        })
        return res.status(200).json({returnProducts});
    }catch(error){
        return res.status(500).json({ error: "Error al obtener el producto" });
    }
}

module.exports = {
  getReturnProducts,
  getOneReturnProdcts
};
