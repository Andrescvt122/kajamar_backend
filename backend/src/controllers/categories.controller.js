// controllers/categories.controller.js
const prisma = require("../prisma/prismaClient");

const categoryProductSelect = {
  id_producto: true,
  nombre: true,
  stock_actual: true,
  url_imagen: true,
};

const formatCategory = (category) => {
  const products = Array.isArray(category.productos) ? category.productos : [];
  const imageProduct = products.find(
    (product) => product.url_imagen && String(product.url_imagen).trim() !== ""
  );

  return {
    ...category,
    productos: products,
    imagen_categoria: imageProduct?.url_imagen || null,
  };
};

// ✅ Obtener todas las categorías

const getAllCategories = async(req,res)=>{
  try{
    const categories = await prisma.categorias.findMany({
      orderBy: { id_categoria: "desc" },
      include:{
        productos:{
          select: categoryProductSelect,
        }
      }
    });

    res.status(200).json(categories.map(formatCategory));
  }catch(error){
    console.error("❌ Error al obtener categorías:", error);
    res.status(500).json({
      message: "Error al obtener las categorías"
    });
  }
}

const searchCategories = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) {
      return res.status(200).json({ data: [] });
    }

    const normalized = q.toLowerCase();
    const numericId = Number(q);
    const isNumeric = !Number.isNaN(numericId);
    const statusFilters = [];

    if (/^activos?$/.test(normalized)) statusFilters.push(true);
    if (/^inactivos?$/.test(normalized)) statusFilters.push(false);

    const categories = await prisma.categorias.findMany({
      where: {
        OR: [
          ...(isNumeric ? [{ id_categoria: numericId }] : []),
          {
            nombre_categoria: {
              contains: q,
              mode: "insensitive",
            },
          },
          {
            descripcion_categoria: {
              contains: q,
              mode: "insensitive",
            },
          },
          ...statusFilters.map((estado) => ({ estado })),
        ],
      },
      orderBy: { id_categoria: "desc" },
    });

    res.status(200).json({ data: categories });
  } catch (error) {
    console.error("❌ Error al buscar categorías:", error);
    res.status(500).json({
      message: "Error al buscar las categorías",
    });
  }
};

const getCategories = async (req, res) => {
  try {

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const search = req.query.search || "";

    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            {
              nombre_categoria: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              descripcion_categoria: {
                contains: search,
                mode: "insensitive",
              },
            },
          ],
        }
      : {};

    const [categories, total] = await Promise.all([
      prisma.categorias.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id_categoria: "desc" },
        include: {
          productos: {
            select: categoryProductSelect,
          },
        },
      }),
      prisma.categorias.count({
        where,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      data: categories.map(formatCategory),
      currentPage: page,
      totalPages,
      totalItems: total,
    });

  } catch (error) {

    console.error("❌ Error al obtener categorías:", error);

    res.status(500).json({
      message: "Error al obtener las categorías"
    });

  }
};
// ✅ Obtener una categoría por ID
const getCategoryById = async (req, res) => {
  const { id } = req.params;
  try {
    const category = await prisma.categorias.findUnique({
      where: { id_categoria: Number(id) },
      include: {
        productos: {
          select: categoryProductSelect,
        },
      },
    });
    if (!category)
      return res.status(404).json({ message: "Categoría no encontrada" });

    res.json(formatCategory(category));
  } catch (error) {
    console.error("❌ Error al obtener la categoría:", error);
    res.status(500).json({ message: "Error al obtener la categoría" });
  }
};

// ✅ Crear nueva categoría
const createCategory = async (req, res) => {
  try {
    const { nombre_categoria, descripcion_categoria, estado } = req.body;

    if (!nombre_categoria || !nombre_categoria.trim()) {
      return res
        .status(400)
        .json({ message: "El nombre de la categoría es obligatorio." });
    }

    const category = await prisma.categorias.create({
      data: {
        nombre_categoria: nombre_categoria.trim(),
        descripcion_categoria: descripcion_categoria || null,
        estado: estado ?? true,
      },
    });

    res.status(201).json({
      message: "Categoría creada correctamente",
      category,
    });
  } catch (error) {
    console.error("❌ Error al crear categoría:", error);

    // 🔹 Único nombre de categoría
    if (error.code === "P2002") {
      return res.status(400).json({
        message: "Ya existe una categoría con ese nombre.",
      });
    }

    res.status(500).json({ message: "Error al crear la categoría" });
  }
};

// ✅ Actualizar categoría
const updateCategory = async (req, res) => {
  const { id } = req.params;
  const { nombre_categoria, descripcion_categoria, estado } = req.body;

  try {
    const category = await prisma.categorias.update({
      where: { id_categoria: Number(id) },
      data: {
        nombre_categoria,
        descripcion_categoria,
        estado,
      },
    });

    res.json({
      message: "Categoría actualizada correctamente",
      category,
    });
  } catch (error) {
    console.error("❌ Error al actualizar categoría:", error);

    // No existe
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ message: "La categoría no existe o ya fue eliminada." });
    }

    // Nombre duplicado
    if (error.code === "P2002") {
      return res.status(400).json({
        message: "Ya existe otra categoría con ese nombre.",
      });
    }

    res.status(500).json({ message: "Error al actualizar la categoría" });
  }
};

// ✅ Eliminar categoría
const deleteCategory = async (req, res) => {
  const { id } = req.params;
  const idNum = Number(id);

  try {
    // Primero verificamos que exista
    const category = await prisma.categorias.findUnique({
      where: { id_categoria: idNum },
    });

    if (!category) {
      return res
        .status(404)
        .json({ message: "La categoría no existe o ya fue eliminada." });
    }

    await prisma.categorias.delete({
      where: { id_categoria: idNum },
    });

    res.json({ message: "Categoría eliminada correctamente" });
  } catch (error) {
    console.error("❌ Error al eliminar categoría:", error);

    // 🔹 Restricción de FK: tiene productos asociados
    if (error.code === "P2003") {
      return res.status(400).json({
        message:
          "No se puede eliminar la categoría porque tiene productos asociados. " +
          "Elimina o reasigna esos productos antes de continuar.",
      });
    }

    res.status(500).json({ message: "Error al eliminar la categoría" });
  }
};

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllCategories,
  searchCategories,
};
