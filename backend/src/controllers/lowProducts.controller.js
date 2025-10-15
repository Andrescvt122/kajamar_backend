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
    const data = req.body;
    const fecha = new Date();
    try{
        const responsable = await prisma.usuarios.findUnique({
            where:{
                usuario_id: data.id_responsable
            }
        })
        const lowProduct = await prisma.productos_baja.create({
            data:{
                id_responsabl: responsable.usuario_id,
                fecha_baja: fecha.toISOString().slice(0, 19).replace('T', ' '),
                
            }
        })
    }catch(error){
        return res.status(500).json({error:"Error al crear el producto"});
    }
}

module.exports = {
    getLowProducts,
    createLowProduct
}