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
      console.log('Tables not found. Please create them in Supabase dashboard using the SQL in README.md');
    } else {
      console.log('Database connection verified');
    }
  } catch (err) {
    console.error('Database init error:', err.message);
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
    console.error('Error saving call:', error);
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
    console.error('Error updating call:', error);
  }
}

export async function getCallBySid(callSid) {
  const { data, error } = await supabase
    .from('calls')
    .select('*')
    .eq('twilio_call_sid', callSid)
    .single();
  
  if (error) {
    console.error('Error fetching call:', error);
    return null;
  }
  
  return data;
}

export { supabase };