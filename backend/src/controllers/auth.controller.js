const prisma = require("../prisma/prismaClient");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // Viene nativo en Node.js
const { sendEmail } = require('../utils/mailer'); // El archivo que creamos en el paso 1

const JWT_SECRET = process.env.JWT_SECRET || 'secreto_temporal';

// 1. INICIAR SESIÓN (Login)
const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Buscar el usuario por correo
        const usuario = await prisma.acceso.findUnique({
            where: { email },
            include: { roles: true, usuarios: true } // Traemos rol y datos personales
        });

        // Validaciones básicas
        if (!usuario) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        if (!usuario.estado_usuario) {
            return res.status(403).json({ error: 'Usuario inactivo. Contacte al administrador.' });
        }

        // Comparar contraseña (Hash vs Texto plano)
        const isMatch = await bcrypt.compare(password, usuario.password_hash);
        
        if (!isMatch) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // Generar Token JWT
        const token = jwt.sign(
            { 
                uid: usuario.acceso_id, 
                rol: usuario.roles.rol_nombre,
                rol_id: usuario.rol_id 
            },
            JWT_SECRET,
            { expiresIn: '8h' } // El token dura 8 horas
        );

        // Responder al frontend
        res.json({
            message: 'Bienvenido',
            token,
            user: {
                id: usuario.acceso_id,
                email: usuario.email,
                nombre: usuario.usuarios?.nombre || 'Usuario',
                rol: usuario.roles.rol_nombre
            }
        });

    } catch (error) {
        console.error("Error en login:", error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
};

// 2. SOLICITAR RECUPERACIÓN (Forgot Password)
const forgotPassword = async (req, res) => {
    const { email } = req.body;

    console.log("----------------------------------------------------");
    console.log("🔍 DEBUG: Iniciando recuperación para:", email);

    try {
        // 1. Buscamos el usuario
        // IMPORTANTE: Asegúrate de que no tenga espacios extra
        const emailLimpio = email.trim(); 
        
        const usuario = await prisma.acceso.findUnique({ 
            where: { email: emailLimpio } 
        });

        // 2. Verificamos si lo encontró
        if (!usuario) {
            console.log("❌ DEBUG: Usuario NO encontrado en la base de datos.");
            console.log("   -> Busqué:", emailLimpio);
            // Retornamos éxito falso por seguridad, pero ya sabemos que falló aquí
            return res.json({ message: 'Si el correo existe, se enviaron instrucciones.' });
        }

        console.log("✅ DEBUG: Usuario encontrado ID:", usuario.acceso_id);

        // 3. Generar Token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);

        console.log("📝 DEBUG: Guardando token en BD...");

        // 4. Guardar en tabla password_resets
        // Usamos upsert o create, pero verificamos si falla aquí
        await prisma.password_resets.create({
            data: {
                acceso_id: usuario.acceso_id,
                token: token,
                expires_at: expiresAt
            }
        });

        console.log("✅ DEBUG: Token guardado.");

        // 5. Enviar Correo
        const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;
        console.log("📧 DEBUG: Intentando enviar correo a:", emailLimpio);

        const emailEnviado = await sendEmail(
            emailLimpio,
            "Recuperar Contraseña - Kajamart",
            `<p>Haz clic aquí para recuperar tu clave: <a href="${resetLink}">Click aquí</a></p>`
        );

        if (emailEnviado) {
            console.log("✅ DEBUG: ¡Mailer reporta envío exitoso!");
        } else {
            console.log("❌ DEBUG: Mailer devolvió false (falló el envío).");
        }

        res.json({ message: 'Si el correo existe, se enviaron instrucciones.' });

    } catch (error) {
        console.error("❌ DEBUG ERROR CRÍTICO:", error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// 3. CAMBIAR CONTRASEÑA (Reset Password)
const resetPassword = async (req, res) => {
    const { token } = req.params; // Viene en la URL
    const { newPassword } = req.body;

    try {
        // Buscar el token en la BD
        const resetRecord = await prisma.password_resets.findUnique({
            where: { token },
            include: { acceso: true }
        });

        if (!resetRecord) {
            return res.status(400).json({ error: 'El enlace es inválido o ya fue usado.' });
        }

        // Verificar si expiró
        if (new Date() > resetRecord.expires_at) {
            return res.status(400).json({ error: 'El enlace ha expirado. Solicita uno nuevo.' });
        }

        // Encriptar la nueva contraseña
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(newPassword, salt);

        // Actualizar el usuario
        await prisma.acceso.update({
            where: { acceso_id: resetRecord.acceso_id },
            data: { password_hash }
        });

        // Borrar el token para que no se pueda volver a usar
        await prisma.password_resets.delete({
            where: { id: resetRecord.id }
        });

        res.json({ message: 'Contraseña actualizada correctamente. Ahora puedes iniciar sesión.' });

    } catch (error) {
        console.error("Error resetPassword:", error);
        res.status(500).json({ error: 'Error al cambiar la contraseña' });
    }
};

module.exports = { login, forgotPassword, resetPassword };