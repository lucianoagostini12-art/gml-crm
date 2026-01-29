// lib/whatsapp.ts
import axios from 'axios';

// Toma las credenciales de tus variables de entorno (.env.local o Vercel)
const META_TOKEN = process.env.META_ACCESS_TOKEN; 
const META_PHONE_ID = process.env.META_PHONE_ID; 
const META_VERSION = 'v21.0'; // Versión de la API de Meta

export async function sendWhatsAppMessage(to: string, text: string) {
  try {
    // Armamos la URL oficial de Meta
    const url = `https://graph.facebook.com/${META_VERSION}/${META_PHONE_ID}/messages`;
    
    // Armamos el paquete de datos según pide la documentación de WhatsApp
    const data = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to,      // El número del cliente (solo números, sin +)
      type: "text",
      text: { 
        preview_url: false, 
        body: text // El mensaje que le querés mandar
      }
    };

    // Configuramos los permisos (Header con el Token)
    const config = {
      headers: {
        'Authorization': `Bearer ${META_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    // Enviamos la petición POST a Meta usando Axios
    const response = await axios.post(url, data, config);
    
    // Si todo salió bien, devolvemos la respuesta de Meta
    return response.data;

  } catch (error: any) {
    // Si falla, mostramos el error detallado en la consola para saber qué pasó
    console.error('❌ Error enviando a Meta:', error.response?.data || error.message);
    
    // Re-lanzamos el error para que la función que llamó a esta sepa que falló
    throw error;
  }
}