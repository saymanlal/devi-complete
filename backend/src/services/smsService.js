import { twilioClient } from './twilioService.js';
import dotenv from 'dotenv';

dotenv.config();

export async function sendSMS(body) {
  try {
    const message = await twilioClient.messages.create({
      body: body.substring(0, 1600),
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.USER_PHONE_NUMBER
    });
    console.log('SMS sent:', message.sid);
    return message.sid;
  } catch (error) {
    console.error('SMS send error:', error);
    throw error;
  }
}