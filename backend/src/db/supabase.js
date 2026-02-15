import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export async function initDatabase() {
  try {
    const { error } = await supabase.from('calls').select('id').limit(1);
    if (error && error.code === '42P01') {
      console.log('Tables not found. Create them in Supabase dashboard.');
    } else {
      console.log('Database connected');
    }
  } catch (err) {
    console.error('Database error:', err.message);
  }
}

export async function saveCall(data) {
  const { data: result, error } = await supabase
    .from('calls')
    .insert([{
      caller_number: data.caller_number,
      twilio_call_sid: data.twilio_call_sid,
      missed_at: data.missed_at,
      callback_initiated_at: data.callback_initiated_at,
      status: 'callback_initiated'
    }])
    .select()
    .single();
  
  if (error) {
    console.error('Save call error:', error);
    return null;
  }
  return result;
}

export async function updateCall(callSid, updates) {
  const { error } = await supabase
    .from('calls')
    .update(updates)
    .eq('twilio_call_sid', callSid);
  
  if (error) {
    console.error('Update call error:', error);
  }
}

export async function getCallBySid(callSid) {
  const { data, error } = await supabase
    .from('calls')
    .select('*')
    .eq('twilio_call_sid', callSid)
    .single();
  
  if (error) {
    console.error('Get call error:', error);
    return null;
  }
  return data;
}

export { supabase };