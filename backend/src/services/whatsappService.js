import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

const headers = () => ({
  'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
  'Content-Type': 'application/json'
});

export async function sendWhatsAppMessage(text) {
  try {
    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: process.env.WHATSAPP_RECIPIENT,
        type: 'text',
        text: { body: text }
      },
      { headers: headers() }
    );
    console.log('WhatsApp message sent:', response.data.messages?.[0]?.id);
    return true;
  } catch (error) {
    console.error('WhatsApp send error:', error.response?.data || error.message);
    return false;
  }
}

export async function sendWhatsAppAudio(audioUrl, caption) {
  try {
    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: process.env.WHATSAPP_RECIPIENT,
        type: 'audio',
        audio: { link: audioUrl }
      },
      { headers: headers() }
    );
    console.log('WhatsApp audio sent:', response.data.messages?.[0]?.id);
    return true;
  } catch (error) {
    console.error('WhatsApp audio error:', error.response?.data || error.message);
    return false;
  }
}