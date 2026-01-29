// lib/whatsapp.ts
import axios from 'axios';

// Estos datos los toma de tu archivo .env.local que ya configuraste
const META_TOKEN = process.env.META_ACCESS_TOKEN; 
const META_PHONE_ID = process.env.META_PHONE_ID; 
const META_VERSION = 'v21.0'; 

export async function sendWhatsAppMessage(to: string, text: string) {
  try {
    const url = `https://graph.facebook.com/${META_VERSION}/${META_PHONE_ID}/messages`;
    
    const data = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to,
      type: "text",
      text: { 
        preview_url: false, 
        body: text 
      }
    };

    const config = {
      headers: {
        'Authorization': `Bearer ${META_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const response = await axios.post(url, data, config);
    return response.data;
  } catch (error: any) {
    console.error('❌ Error enviando a Meta:', error.response?.data || error.message);
    throw error;
  }
}