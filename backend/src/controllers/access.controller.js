const prisma = require("../prisma/prismaClient");
const bcrypt = require('bcryptjs'); // <--- IMPORTANTE: Usamos bcryptjs

// GET /access - Gets all access records (IGUAL)
const getAccesses = async (req, res) => {
    try {
        const accesses = await prisma.acceso.findMany({
            select: {
                acceso_id: true,
                email: true,
                estado_usuario: true,
                roles: {
                    select: {
                        rol_nombre: true
                    }
                }
            },
        });
        return res.status(200).json(accesses);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error getting accesses" });
    }
};

// GET /access/:id - Gets an access record by ID (IGUAL)
const getAccessById = async (req, res) => {
    const acceso_id = Number(req.params.id);
    try {
        const access = await prisma.acceso.findUnique({
            where: { acceso_id },
            include: { roles: true, usuarios: true },
        });

        if (!access) {
            return res.status(404).json({ error: 'Access not found' });
        }

        const { password_hash, ...accessWithoutHash } = access;

        return res.status(200).json(accessWithoutHash);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error getting the access record" });
    }
};

// POST /access - Creates a new access record (MODIFICADO)
const createAccess = async (req, res) => {
    const { email, password, rol_id } = req.body;
    try {
        // ENCRIPTACIÓN DE CONTRASEÑA
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const newAccess = await prisma.acceso.create({
            data: {
                email,
                password_hash, // Guardamos la versión encriptada
                rol_id: Number(rol_id),
            },
        });

        return res.status(201).json({ message: 'Access created successfully', data: newAccess });
    } catch (error) {
        console.error(error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'The email is already registered.' });
        }
        return res.status(500).json({ error: "Error creating the access record" });
    }
};

// PUT /access/:id - Updates an access record (MODIFICADO)
const updateAccess = async (req, res) => {
    const acceso_id = Number(req.params.id);
    const { email, password, rol_id, estado_usuario } = req.body;
    
    let updateData = { 
        email, 
        rol_id: rol_id ? Number(rol_id) : undefined, 
        estado_usuario 
    };

    try {
        if (password) {
            // Si envían password nuevo, lo encriptamos también
            const salt = await bcrypt.genSalt(10);
            updateData.password_hash = await bcrypt.hash(password, salt);
        }

        const updatedAccess = await prisma.acceso.update({
            where: { acceso_id },
            data: { ...updateData, updated_at: new Date() },
        });

        return res.status(200).json({ message: 'Access updated successfully', data: updatedAccess });
    } catch (error) {
        console.error(error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Access not found for update' });
        }
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'The new email is already in use.' });
        }
        return res.status(500).json({ error: "Error updating the access record" });
    }
};

// DELETE /access/:id - Deletes an access record (IGUAL)
const deleteAccess = async (req, res) => {
    const acceso_id = Number(req.params.id);
    try {
        await prisma.acceso.delete({
            where: { acceso_id },
        });

        return res.status(200).json({ message: 'Access deleted successfully' });
    } catch (error) {
        console.error(error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Access not found for deletion' });
        }
        return res.status(500).json({ error: "Error deleting the access record" });
    }
};

module.exports = {
    getAccesses,
    getAccessById,
    createAccess,
    updateAccess,
    deleteAccess,
};