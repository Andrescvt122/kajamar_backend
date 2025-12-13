require('dotenv').config();
const nodemailer = require('nodemailer');

async function main() {
  console.log("---------------------------------------");
  console.log("📧 Probando configuración de correo...");
  console.log("Usuario:", process.env.EMAIL_USER);
  
  if (!process.env.EMAIL_PASS) {
      console.log("❌ ERROR: No tienes EMAIL_PASS en tu archivo .env");
      return;
  }
  
  // Imprimimos solo los primeros caracteres de la pass para verificar
  console.log("Pass (oculta):", process.env.EMAIL_PASS.substring(0, 3) + "...");

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // Se envía a sí mismo
      subject: "Prueba de Kajamart Backend",
      text: "¡Si lees esto, el correo funciona correctamente!"
    });
    console.log("✅ ¡ÉXITO! Correo enviado.");
    console.log("ID del mensaje:", info.messageId);
    console.log("---------------------------------------");
  } catch (error) {
    console.error("❌ FALLÓ EL ENVÍO:");
    console.error(error.message);
    
    if(error.response) {
        console.error("Respuesta del servidor:", error.response);
    }
    console.log("---------------------------------------");
    console.log("💡 PISTA: Si el error es 'Invalid login', revisa tu contraseña de aplicación.");
  }
}

main();