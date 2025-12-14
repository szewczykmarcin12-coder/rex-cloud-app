// ============================================
// REX CLOUD - USER MANAGEMENT
// ============================================
// Hasła są hashowane za pomocą SHA-256
// Każdy użytkownik ma przypisany unikalny calendarId

// Funkcja hashująca SHA-256 (działa w przeglądarce)
export const hashPassword = async (password) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Funkcja weryfikująca hasło
export const verifyPassword = async (password, hash) => {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
};

// Baza użytkowników
// Każdy użytkownik ma unikalny calendarId przypisany do swojego konta
export const USERS = [
  {
    id: 'user_ms_001',
    // PIN "4917" -> SHA-256
    pinHash: '8eebb0799014a38852ffad12b8ba8c3fad326e1b92f83a01549c4e69b0bb9893',
    // Unikalny identyfikator kalendarza użytkownika (używany w GitHub repo)
    calendarId: 'kalendarz',
    // Dane profilu
    profile: {
      name: 'MARCIN SZEWCZYK',
      initials: 'MS',
      email: 'szewczyk.marcin12@gmail.com',
      company: 'Rex Concepts',
      phone: '',
      address: 'Kraków',
      hourlyRate: 0
    }
  }
];

// Funkcja logowania - zwraca użytkownika lub null
export const authenticateUser = async (email, pin) => {
  const emailLower = email.toLowerCase().trim();
  const pinTrimmed = pin.trim();
  
  for (const user of USERS) {
    // Sprawdź czy email pasuje
    if (user.profile.email.toLowerCase() === emailLower) {
      // Weryfikuj PIN przez porównanie hashy
      const pinHash = await hashPassword(pinTrimmed);
      if (pinHash === user.pinHash) {
        return {
          id: user.id,
          calendarId: user.calendarId,
          profile: { ...user.profile }
        };
      }
    }
  }
  return null;
};

// Helper do generowania hashy (dla nowych użytkowników)
// Użyj w konsoli: generateHash('twoj_pin')
export const generateHash = async (text) => {
  const hash = await hashPassword(text);
  console.log(`Text: ${text} -> Hash: ${hash}`);
  return hash;
};

export default { USERS, authenticateUser, hashPassword, verifyPassword, generateHash };
