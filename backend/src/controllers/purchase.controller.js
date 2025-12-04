const prisma = require("../prisma/prismaClient");

const getAllPruchase = async (req,res)=>{
    try{
        const purchase = await prisma.compras.findMany({
            include:{
                detalle_compra:true,
                proveedores:true
            }
        })
        return res.status(200).json({purchase})
    }catch(error){
        return res.status(500).json({error:"Error al obtener las compras"})
    }
}

module.exports={
    getAllPruchase
}