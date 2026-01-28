const prisma = require('../../prisma/prismaClient');      

const searachSale = async (req,res) =>{
    const q = String(req.params.q).trim();
    try{
        const sale = await prisma.ventas.findMany({
            where:{
                OR:[
                    {id_venta: isNaN(Number(q)) ? undefined : Number(q)},
                    {clientes:{is:{nombre_cliente:{contains :q, mode: "insensitive"}}}},
                    {detalle_venta:{some:{detalle_productos:{is:{productos:{nombre  :{contains :q, mode: "insensitive"}}}}}}},
                    {fecha_venta: isNaN(Date.parse(q)) ? undefined : new Date(q)}
                ]
            },include:{clientes:true, detalle_venta:{include:{detalle_productos:{include:{productos:true}}}}}
        })
        return res.status(200).json({sale})
    }catch(error){
        return res.status(500).json({error:"Error al buscar las ventas"})
    }
}

module.exports = {searachSale};