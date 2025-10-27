// rolesController.js

const prisma = require("../prisma/prismaClient");

// GET /roles - Gets all roles
const getRoles = async (req, res) => {
    try {
        const roles = await prisma.roles.findMany({
            include: {
                rol_permisos: { // role_permissions
                    include: {
                        permisos: true // permissions
                    }
                },
            },
        });
        return res.status(200).json(roles);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error getting roles" });
    }
};

// GET /roles/:id - Gets a role by ID
const getRoleById = async (req, res) => {
    const rol_id = Number(req.params.id); // role_id
    try {
        const rol = await prisma.roles.findUnique({
            where: { rol_id }, // role_id
            include: {
                rol_permisos: { // role_permissions
                    include: {
                        permisos: true // permissions
                    }
                },
            },
        });

        if (!rol) {
            return res.status(404).json({ error: 'Role not found' });
        }

        return res.status(200).json(rol);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error getting the role" });
    }
};

// POST /roles - Creates a new role
const createRole = async (req, res) => {
    const { rol_nombre, descripcion, estado_rol, permisosIds = [] } = req.body; // role_name, description, role_status, permissionsIds
    try {
        const nuevoRol = await prisma.roles.create({ // newRole
            data: {
                rol_nombre, // role_name
                descripcion, // description
                estado_rol, // role_status
                rol_permisos: { // role_permissions
                    create: permisosIds.map((permiso_id) => ({ // permissionsIds, permission_id
                        permiso_id: Number(permiso_id), // permission_id
                    })),
                },
            },
            include: {
                rol_permisos: true, // role_permissions
            },
        });

        return res.status(201).json({ message: 'Role created successfully', data: nuevoRol });
    } catch (error) {
        console.error(error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'The role name already exists.' });
        }
        return res.status(500).json({ error: "Error creating the role" });
    }
};

// PUT /roles/:id - Updates a role
const updateRole = async (req, res) => {
    const rol_id = Number(req.params.id); // role_id
    const { rol_nombre, descripcion, estado_rol, permisosIds = [] } = req.body; // role_name, description, role_status, permissionsIds

    try {
        // Delete and recreate permission relationships
        await prisma.rol_permisos.deleteMany({ // role_permissions
            where: { rol_id }, // role_id
        });

        const rolActualizado = await prisma.roles.update({ // updatedRole
            where: { rol_id }, // role_id
            data: {
                rol_nombre, // role_name
                descripcion, // description
                estado_rol, // role_status
                rol_permisos: { // role_permissions
                    create: permisosIds.map((permiso_id) => ({ // permissionsIds, permission_id
                        permiso_id: Number(permiso_id), // permission_id
                    })),
                },
            },
            include: {
                rol_permisos: true, // role_permissions
            },
        });

        return res.status(200).json({ message: 'Role updated successfully', data: rolActualizado });
    } catch (error) {
        console.error(error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Role not found for update' });
        }
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'The new role name is already in use.' });
        }
        return res.status(500).json({ error: "Error updating the role" });
    }
};

// DELETE /roles/:id - Deletes a role
const deleteRole = async (req, res) => {
    const rol_id = Number(req.params.id); // role_id
    try {
        await prisma.roles.delete({
            where: { rol_id }, // role_id
        });

        return res.status(200).json({ message: 'Role deleted successfully' });
    } catch (error) {
        console.error(error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Role not found for deletion' });
        }
        if (error.code === 'P2003') {
            return res.status(400).json({ error: 'Cannot delete the role because it is associated with Access records.' });
        }
        return res.status(500).json({ error: "Error deleting the role" });
    }
};

module.exports = {
    getRoles,
    getRoleById,
    createRole,
    updateRole,
    deleteRole,
};