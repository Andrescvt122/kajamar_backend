const prisma = require("../prisma/prismaClient");

const getLowProducts = async (req,res) => {
    try{
        const lowProducts = await prisma.productos_baja.findMany();
        return res.status(200).json(lowProducts);
    }catch(error){
        return res.status(500).json({error:"Error al obtener los productos"});
    }
}

const getResponsable = async (id)=>{
    try{
        const responsable = await prisma.usuarios.findUnique({
            where:{
                usuarios_id: id
            }
    })
        return responsable;
    } catch(error){
        console.log("No se encontro responsable")
    }
}

const createLowProduct = async (req,res) =>{
    const data = req.body;
    const responsable = await getResponsable(data.usuarios_id);
    if(responsable){
        try{
            // cabecera
            const result = await prisma.$transaction(async (tx)=>{
                const lowProduct = await tx.productos_baja.create({
                    data:{
                        id_responsable: responsable.nombre,
                        fecha_baja: new Date().toISOString().split('T')[0],
                        cantidad_baja: cantidad_total_baja,
                        total_precio_baja: total_precio_baja
                    }
                })
                // detalle
                for (const p of data.products){
                    const detalle = await tx.detalle_productos_baja.create({
                        data:{
                            id_baja_productos: lowProduct.id_baja_productos,
                            id_detalle_productos: p.id_detalle_productos,
                            cantidad: p.cantidad,
                            motivo: p.motivo,
                            total_producto_baja: p.total_producto_baja
                        }
                    })
                    await tx.detalle_productos.update({
                        where:{
                            id_detalle_productos: p.id_detalle_productos
                        },
                        data:{
                            stock_producto: {
                                decrement: p.cantidad
                            }
                        }
                    })
                }
            })
        }catch(error){
            return res.status(500).json({error:"Error al crear el producto"});
        }
    }
}

module.exports = {
    getLowProducts,
    createLowProduct
}