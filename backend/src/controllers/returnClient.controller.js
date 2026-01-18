const prisma = require('../prisma/prismaClient');
const {getResponsable} = require('./returnProducts.controller');

const getReturnClients = async (req, res)=>{
    try {
        const returnClients = await prisma.devolucion_cliente.findMany({
            include:{
                ventas:{
                    include:{
                        clientes:true
                    }
                },
                detalle_devolucion_cliente:{
                    include:{
                        detalle_venta:{
                            include:{
                                detalle_productos:{
                                    include:{productos:true}
                                }
                            }
                        },
                        detalle_productos:{
                            include:{productos:true}
                        }
                    }
                }
            }
        })
        return res.status(200).json({returnClients});
    }catch (error){
        return res.status(500).json({error: "Error al obtener las devoluciones a clientes"});
    }
}

module.exports ={
    getReturnClients
}