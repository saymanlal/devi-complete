import { twilioClient } from './twilioService.js';
import dotenv from 'dotenv';

dotenv.config();

export async function sendSMS(body) {
  try {
    const message = await twilioClient.messages.create({
      body: body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.USER_PHONE_NUMBER,
    });
    
    console.log('SMS sent:', message.sid);
    return message.sid;
  } catch (error) {
    console.error('SMS error:', error);
    throw error;
  }
}