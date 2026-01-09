const prisma = require('../../prisma/prismaClient');

// Controlador para búsqueda de compras
exports.searchPurchase = async (req,res)=>{
    const q = String(req.params.q).trim();
    console.log(q);
    try{
        const purchase = await prisma.compras.findMany({
            where:{
                OR:[
                    {id_compra: isNaN(Number(q)) ? undefined : Number(q)},
                    {proveedores:{is:{nombre:{contains :q, mode: "insensitive"}}}},
                    {detalle_compra:{some:{detalle_productos:{is:{productos:{nombre:{contains :q, mode: "insensitive"}}}}}}},
                    {fecha_compra: isNaN(Date.parse(q)) ? undefined : new Date(q)}
                ]
            },include:{proveedores:true, detalle_compra:{include:{detalle_productos:{include:{productos:true}}}}}
        })
        return res.status(200).json({purchase})
    }catch(error){
        return res.status(500).json({error:"Error al buscar las compras"})
    }
}