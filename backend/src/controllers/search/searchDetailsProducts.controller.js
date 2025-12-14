const prisma = require("../../prisma/prismaClient");

const searchDetailsProducts = async (req,res)=>{
        const q = String(req.params.q).trim();
    try{
        const detailsProducts = await prisma.detalle_productos.findMany({
            where:{
                OR:[
                    {codigo_barras_producto_compra: {contains :q, mode: "insensitive"}},
                    {productos:{is:{nombre:{contains :q, mode: "insensitive"}}}}
                ]
            },
            include:{productos:true}
        }) 
        return res.status(200).json(detailsProducts ? detailsProducts : 'no se encontro ningun producto');
    }catch(error){
        return res.status(500).json({error:"Error al buscar los productos"});
    }
}

module.exports = {
    searchDetailsProducts
}
