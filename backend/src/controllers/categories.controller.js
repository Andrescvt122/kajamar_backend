const prisma = require("../prisma/prismaClient");
// obtener todas las categorias
const getCategories = async (req,res)=>{
    try{
        const categories = await prisma.categorias.findMany();
        return res.status(200).json(categories);
    }catch(error){
        return res.status(500).json({error:"Error al obtener las categorias"});
    }
}

// obtener categoria por id
const getCategoryById = async (req,res)=>{
    try{
        const category = await prisma.categorias.findUnique({
            where:{
                id_categoria: parseInt(req.params.id)
            }
        });
        return res.status(200).json(category);
    }catch(error){
        return res.status(500).json({error:"Error al obtener la categoria"});
    }
}

// crear una categoria
const createCategory = async (req,res)=>{
    const {nombre_categoria, descripcion_categoria, estado} = req.body;
    try{
        const category = await prisma.categorias.create({
            data:{
                nombre_categoria,
                descripcion_categoria,
                estado
            }
        });
        return res.status(201).json(category);
    }catch(error){
        return res.status(500).json({error:"Error al crear la categoria"});
    }
}
module.exports = {
    getCategories,
    getCategoryById,
    createCategory
}