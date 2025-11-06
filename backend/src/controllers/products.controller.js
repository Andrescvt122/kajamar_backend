const prisma = require("../prisma/prismaClient");

const getRandomProduct = async (req,res)=>{
    const {q} = req.query;
    const id_categoria_int = parseInt(q)
    console.log(q);
    try {
        const ids = await prisma.productos.findMany({
            where: {
                id_categoria: {
                    equals: id_categoria_int
                }
            }
        })
        if (ids.length === 0){
            return res.status(404).json({
                message: "No se encontraron productos"
            })
        }
        while (true){
        const id_producto = Math.floor(Math.random() * ids.length)
        const product = await prisma.productos.findUnique({
            where: {
                id_producto: ids[id_producto].id_producto
            }
        })
        if (product){
            return res.status(200).json({
                product
            });
        }
        }
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Error al obtener el producto"
        })
    }
}

module.exports = {
    getRandomProduct
}
