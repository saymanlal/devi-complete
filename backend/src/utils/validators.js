export function validatePhoneNumber(phone) {
  if (!phone) return false;
  // Allow +91 followed by 10 digits or just 10 digits
  const cleaned = phone.replace(/\s+/g, '');
  return /^(\+91)?[6-9]\d{9}$/.test(cleaned);
}

export function sanitizePhoneNumber(phone) {
  // Remove all spaces and ensure +91 prefix
  let cleaned = phone.replace(/\s+/g, '');
  if (!cleaned.startsWith('+')) {
    cleaned = '+91' + cleaned.replace(/^91/, '');
  }
  return cleaned;
}