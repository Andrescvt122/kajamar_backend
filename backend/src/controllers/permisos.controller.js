const prisma = require("../prisma/prismaClient");

// ✅ GET /permisos - Lista todos los permisos agrupados por módulo
const getPermisos = async (req, res) => {
  try {
    const permisos = await prisma.permisos.findMany({
      orderBy: { modulo: "asc" },
    });

    const agrupados = permisos.reduce((acc, permiso) => {
      if (!acc[permiso.modulo]) acc[permiso.modulo] = [];
      acc[permiso.modulo].push({
        permiso_id: permiso.permiso_id,
        permiso_nombre: permiso.permiso_nombre,
      });
      return acc;
    }, {});

    res.status(200).json(agrupados);
  } catch (error) {
    console.error("❌ Error al obtener permisos:", error);
    res.status(500).json({ error: "Error al obtener los permisos" });
  }
};

module.exports = { getPermisos };
