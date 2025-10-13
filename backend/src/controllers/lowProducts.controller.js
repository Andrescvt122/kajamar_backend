const prisma = require("../prisma/prismaClient");

const getLowProducts = async (req,res) => {
    try{
        const lowProducts = await prisma.productos_baja.findMany();
        return res.status(200).json(lowProducts);
    }catch(error){
        return res.status(500).json({error:"Error al obtener los productos"});
    }
}

const createLowProduct = async (req,res) =>{
    try{
        
    }catch(error){
        return res.status(500).json({error:"Error al crear el producto"});
    }
}

module.exports = {
    getLowProducts
}