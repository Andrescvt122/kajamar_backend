// src/controllers/auth.controller.js
const prisma = require("../prisma/prismaClient");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendEmail } = require('../utils/mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'secreto_super_seguro';

// 1. LOGIN (Para entrar después del cambio)
const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const usuario = await prisma.acceso.findUnique({
            where: { email },
            include: { roles: true, usuarios: true }
        });

        if (!usuario || !usuario.estado_usuario) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // Aquí comparamos la contraseña que acabas de cambiar
        const isMatch = await bcrypt.compare(password, usuario.password_hash);

        if (!isMatch) {
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }

        const token = jwt.sign(
            { uid: usuario.usuarios.usuario_id, rol: usuario.roles.rol_nombre, nombre: usuario.usuarios.nombre, rol_id: usuario.roles.rol_id },
            JWT_SECRET, { expiresIn: '8h' }
        );
        res.json({ message: 'Bienvenido', token, user: usuario });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
};

// 2. GENERAR CÓDIGO (Forgot Password)
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    try {
        const emailLimpio = email.trim();
        const usuario = await prisma.acceso.findUnique({ where: { email: emailLimpio } });

        if (!usuario) return res.status(404).json({ error: 'El correo electrónico no está registrado.' });

        // Generar código de 6 dígitos
        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 min validez

        // Guardar código en BD
        await prisma.password_resets.deleteMany({ where: { acceso_id: usuario.acceso_id } });
        await prisma.password_resets.create({
            data: {
                acceso_id: usuario.acceso_id,
                token: codigo,
                expires_at: expiresAt
            }
        });

        // Enviar Correo
        console.log(`📧 Código para ${emailLimpio}: ${codigo}`);
        await sendEmail(emailLimpio, "Código de Recuperación", `<h1>Tu código es: ${codigo}</h1>`);

        res.json({ message: 'Código enviado.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al enviar correo' });
    }
};

// 3. VERIFICAR CÓDIGO Y CAMBIAR PASS (Reset Password)
const resetPassword = async (req, res) => {
    const { email, codigo, newPassword } = req.body;

    try {
        // A. Buscar usuario
        const usuario = await prisma.acceso.findUnique({ where: { email } });
        if (!usuario) return res.status(400).json({ error: 'Usuario no encontrado.' });

        // B. VERIFICAR EL CÓDIGO
        // Buscamos en la tabla de resets si este usuario tiene ese código exacto
        const resetRecord = await prisma.password_resets.findFirst({
            where: {
                acceso_id: usuario.acceso_id,
                token: codigo // Aquí comparamos el número que introdujo el usuario
            }
        });

        if (!resetRecord) {
            return res.status(400).json({ error: 'El código es incorrecto.' });
        }

        // C. Verificar tiempo
        if (new Date() > resetRecord.expires_at) {
            return res.status(400).json({ error: 'El código ha expirado.' });
        }

        // D. ACTUALIZAR CONTRASEÑA
        // Encriptamos la nueva clave para que funcione en el Login
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(newPassword, salt);

        await prisma.acceso.update({
            where: { acceso_id: usuario.acceso_id },
            data: { password_hash }
        });

        // E. Limpiar (Borramos el código usado para que no se use 2 veces)
        await prisma.password_resets.delete({ where: { id: resetRecord.id } });

        res.json({ message: 'Contraseña actualizada correctamente.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al cambiar contraseña' });
    }
};

module.exports = { login, forgotPassword, resetPassword };