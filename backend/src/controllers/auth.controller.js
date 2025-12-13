const prisma = require("../prisma/prismaClient");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendEmail } = require('../utils/mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// 1. LOGIN (Se mantiene igual, solo lo pongo para que no falte)
const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const usuario = await prisma.acceso.findUnique({
            where: { email },
            include: { roles: true, usuarios: true }
        });

        if (!usuario || !usuario.estado_usuario) {
            return res.status(401).json({ error: 'Credenciales inválidas o usuario inactivo' });
        }

        const isMatch = await bcrypt.compare(password, usuario.password_hash);
        if (!isMatch) return res.status(401).json({ error: 'Credenciales inválidas' });

        const token = jwt.sign(
            { uid: usuario.acceso_id, rol: usuario.roles.rol_nombre },
            JWT_SECRET, { expiresIn: '8h' }
        );

        res.json({ message: 'Bienvenido', token, user: usuario });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno' });
    }
};

// 2. OLVIDÉ CONTRASEÑA (Genera Código 6 dígitos)
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    try {
        const emailLimpio = email.trim();
        const usuario = await prisma.acceso.findUnique({ where: { email: emailLimpio } });

        if (!usuario) {
            // Retornamos éxito falso por seguridad
            return res.json({ message: 'Si el correo existe, enviamos el código.' });
        }

        // Generar Código numérico de 6 dígitos
        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Expira en 15 minutos
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15);

        // Borrar códigos viejos y guardar el nuevo
        await prisma.password_resets.deleteMany({ where: { acceso_id: usuario.acceso_id } });
        await prisma.password_resets.create({
            data: {
                acceso_id: usuario.acceso_id,
                token: codigo, 
                expires_at: expiresAt
            }
        });

        // Enviar Correo
        console.log(`📧 Enviando código ${codigo} a ${emailLimpio}`);
        await sendEmail(
            emailLimpio,
            "Tu Código de Recuperación - Kajamart",
            `
            <div style="font-family: sans-serif; text-align: center;">
                <h2>Recuperación de Contraseña</h2>
                <p>Tu código de verificación es:</p>
                <h1 style="background: #eee; display: inline-block; padding: 10px 20px; letter-spacing: 5px; border-radius: 10px;">${codigo}</h1>
                <p>Este código expira en 15 minutos.</p>
            </div>
            `
        );

        res.json({ message: 'Código enviado.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al procesar solicitud' });
    }
};

// 3. RESTABLECER (Verifica Código y Cambia Clave)
const resetPassword = async (req, res) => {
    // Recibe todo junto: Email + Código + Nueva Clave
    const { email, codigo, newPassword } = req.body;

    try {
        const usuario = await prisma.acceso.findUnique({ where: { email } });
        if (!usuario) return res.status(400).json({ error: 'Usuario no encontrado' });

        // Buscar código válido
        const resetRecord = await prisma.password_resets.findFirst({
            where: { 
                acceso_id: usuario.acceso_id,
                token: codigo 
            }
        });

        if (!resetRecord) return res.status(400).json({ error: 'Código inválido' });
        if (new Date() > resetRecord.expires_at) return res.status(400).json({ error: 'El código ha expirado' });

        // Encriptar y guardar
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(newPassword, salt);

        await prisma.acceso.update({
            where: { acceso_id: usuario.acceso_id },
            data: { password_hash }
        });

        // Limpiar token usado
        await prisma.password_resets.delete({ where: { id: resetRecord.id } });

        res.json({ message: 'Contraseña actualizada' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al cambiar contraseña' });
    }
};

module.exports = { login, forgotPassword, resetPassword };