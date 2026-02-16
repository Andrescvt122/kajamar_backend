const nodemailer = require('nodemailer');

// Configuración del transporte (usando variables de entorno)
const transporter = nodemailer.createTransport({
  service: 'gmail', // Puedes cambiar esto si usas Outlook, Yahoo, etc.
  auth: {
    user: process.env.EMAIL_USER, // Tu correo
    pass: process.env.EMAIL_PASS  // Tu "Contraseña de Aplicación"
  }
});

/**
 * Función genérica para enviar correos
 * @param {string} to - Destinatario
 * @param {string} subject - Asunto
 * @param {string} html - Contenido en HTML
 */
const sendEmail = async (to, subject, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"Soporte Técnico" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log("Correo enviado: %s", info.messageId);
    return true;
  } catch (error) {
    console.error("Error enviando correo:", error);
    return false;
  }
};

module.exports = { sendEmail };