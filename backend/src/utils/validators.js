export function validatePhoneNumber(number) {
  const cleaned = number.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

export function sanitizePhoneNumber(number) {
  let cleaned = number.replace(/\D/g, '');
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return `+${cleaned}`;
  } else if (cleaned.length === 10) {
    return `+91${cleaned}`;
  } else if (!number.startsWith('+')) {
    return `+${cleaned}`;
  }
  return number;
}