const prisma = require("../prisma/prismaClient");
const { PrismaClientKnownRequestError } = require("@prisma/client/runtime/library");

// 🟢 GET /roles - Obtiene todos los roles con sus permisos
const getRoles = async (req, res) => {
    try {
        const roles = await prisma.roles.findMany({
            include: {
                // Asegúrate que el nombre de la relación sea 'roles_permisos' o 'rol_permisos'
                rol_permisos: {
                    include: { permisos: true },
                },
            },
        });
        return res.status(200).json(roles);
    } catch (error) {
        console.error("❌ ERROR al obtener roles:", error);
        return res.status(500).json({ error: "Error al obtener roles." });
    }
};

// 🟢 GET /roles/:id - Obtiene un rol específico
const getRoleById = async (req, res) => {
    const rol_id = Number(req.params.id);

    // Validación de ID
    if (isNaN(rol_id) || rol_id <= 0) {
        return res.status(400).json({ error: "ID de rol inválido." });
    }

    try {
        const rol = await prisma.roles.findUnique({
            where: { rol_id },
            include: {
                rol_permisos: {
                    include: { permisos: true },
                },
            },
        });

        if (!rol) return res.status(404).json({ error: "Rol no encontrado." });

        return res.status(200).json(rol);
    } catch (error) {
        console.error("❌ ERROR al obtener rol:", error);
        return res.status(500).json({ error: "Error al obtener el rol." });
    }
};

// 🟢 POST /roles - Crea un nuevo rol con sus permisos
const createRole = async (req, res) => {
    // Nota: El frontend ya debería enviar el rol_nombre, descripcion y permisosIds
    const { rol_nombre, descripcion, estado_rol = true, permisosIds } = req.body; 

    try {
        if (!rol_nombre || rol_nombre.trim() === "") {
            return res.status(400).json({ error: "El nombre del rol es obligatorio." });
        }
        
        // 1. ✅ PRE-VERIFICACIÓN DE UNICIDAD (Mejora clave)
        const existingRole = await prisma.roles.findUnique({
            where: { rol_nombre: rol_nombre },
        });

        if (existingRole) {
            // Devolvemos 409 Conflict antes de la creación para evitar el error P2002
            return res.status(409).json({ error: "El nombre de rol ya existe y debe ser único." });
        }

        // 2. Limpiar IDs duplicados o inválidos
        const permisosValidosUnicos = [
            ...new Set(
                permisosIds
                    .map((id) => Number(id))
                    .filter((id) => Number.isInteger(id) && id > 0)
            ),
        ];

        // 3. Crear rol y relaciones (Uso de 'create' anidado)
        const nuevoRol = await prisma.roles.create({
            data: {
                rol_nombre,
                descripcion,
                estado_rol,
                rol_permisos: {
                    create: permisosValidosUnicos.map((permiso_id) => ({ permiso_id })),
                },
            },
            include: {
                rol_permisos: {
                    include: { permisos: true },
                },
            },
        });

        return res.status(201).json({
            message: "✅ Rol creado correctamente con sus permisos.",
            data: nuevoRol,
        });
    } catch (error) {
        console.error("❌ ERROR al crear rol:", error);
        
        // El P2002 de unicidad ahora debería ser raro, ya que lo pre-verificamos (409)
        if (error.code === "P2002") {
             // Este caso se daría solo en condiciones de carrera o si la pre-verificación falla
             return res.status(409).json({ error: "El nombre del rol ya existe." });
        }
        
        // Manejo de error de Clave Foránea (permiso_id no existe)
        if (error.code === "P2003") {
            return res.status(400).json({ error: "Uno o más IDs de permisos son inválidos o no existen." });
        }
        return res.status(500).json({ error: "Error al crear el rol." });
    }
};

// 🔄 PUT /roles/:id - Actualiza un rol y SINCRONIZA sus permisos
const updateRole = async (req, res) => {
    const rol_id = Number(req.params.id);
    const { rol_nombre, descripcion, estado_rol, permisosIds = [] } = req.body;

    // Validación de ID
    if (isNaN(rol_id) || rol_id <= 0) {
        return res.status(400).json({ error: "ID de rol inválido." });
    }

    try {
        // 1. ✅ PRE-VERIFICACIÓN DE UNICIDAD para la actualización
        if (rol_nombre) {
            const existingRole = await prisma.roles.findUnique({
                where: { rol_nombre: rol_nombre },
            });
            // Si el nombre existe Y pertenece a un ID diferente al que estamos actualizando
            if (existingRole && existingRole.rol_id !== rol_id) {
                return res.status(409).json({ error: "El nombre de rol ya existe y debe ser único." });
            }
        }
        
        // 2. Validar IDs de permisos
        const permisosValidosUnicos = [
            ...new Set(
                permisosIds
                    .map((id) => Number(id))
                    .filter((id) => Number.isInteger(id) && id > 0)
            ),
        ];

        // 3. 🚨 USO DE TRANSACCIÓN: Garantiza que la sincronización sea atómica
        await prisma.$transaction(async (tx) => {
            
            // a. Eliminar TODOS los permisos antiguos (limpiar la tabla intermedia)
            await tx.rol_permisos.deleteMany({ where: { rol_id } });

            // b. Crear TODAS las nuevas relaciones (sólo si hay permisos para crear)
            if (permisosValidosUnicos.length > 0) {
                await tx.rol_permisos.createMany({
                    data: permisosValidosUnicos.map((permiso_id) => ({ 
                        rol_id: rol_id,
                        permiso_id: permiso_id 
                    })),
                    skipDuplicates: true,
                });
            }
            
            // c. Actualizar los campos escalares del rol
            await tx.roles.update({
                where: { rol_id },
                data: { rol_nombre, descripcion, estado_rol },
            });
        });

        // 4. Devolver el rol actualizado con sus nuevos permisos (requiere una consulta final)
        const rolActualizado = await prisma.roles.findUnique({
             where: { rol_id },
             include: {
                 rol_permisos: { include: { permisos: true } },
             },
           });

        return res.status(200).json({
            message: "✅ Rol actualizado correctamente.",
            data: rolActualizado,
        });
    } catch (error) {
        console.error("❌ ERROR al actualizar rol:", error);

        // P2025: Rol no encontrado
        if (error.code === "P2025") {
            return res.status(404).json({ error: "Rol no encontrado para actualización." });
        }
        
        // P2003: Clave foránea fallida (permiso_id o rol_id inválido)
        if (error.code === "P2003") {
             return res.status(400).json({ error: "Uno o más IDs de permisos son inválidos o no existen." });
        }
        
        // P2002: Unicidad (Aunque lo pre-verificamos, lo dejamos como fallback)
        if (error.code === "P2002") {
            return res.status(409).json({ error: "El nombre del rol ya existe." });
        }
        
        return res.status(500).json({ error: "Error al actualizar el rol." });
    }
};

// 🟢 DELETE /roles/:id - Elimina un rol
const deleteRole = async (req, res) => {
    const rol_id = Number(req.params.id);

    // Validación de ID
    if (isNaN(rol_id) || rol_id <= 0) {
        return res.status(400).json({ error: "ID de rol inválido." });
    }

    try {
        // 1. Verificar si el rol está siendo usado por algún registro de acceso.
        const accesosConRol = await prisma.acceso.count({
            where: { rol_id },
        });

        if (accesosConRol > 0) {
            return res.status(409).json({
                error: `No se puede eliminar el rol porque está asignado a ${accesosConRol} usuario(s).`,
            });
        }

        // 2. Si no está en uso, proceder con la eliminación.
        // La eliminación en cascada (configurada en el schema de Prisma) se encargará de los `rol_permisos`.
        await prisma.roles.delete({ where: { rol_id } }); 
        return res.status(200).json({ message: "🗑️ Rol eliminado correctamente." });
    } catch (error) {
        console.error("❌ ERROR al eliminar rol:", error);

        if (error.code === "P2025") {
            return res.status(404).json({ error: "Rol no encontrado para eliminar." });
        }

        return res.status(500).json({ error: "Error al eliminar el rol." });
    }
};

module.exports = {
    getRoles,
    getRoleById,
    createRole,
    updateRole,
    deleteRole,
};