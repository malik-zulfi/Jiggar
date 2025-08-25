import CryptoJS from 'crypto-js';

const secretKey = 'your-super-secret-key'; // In a real app, this should be stored securely

export const secureSetItem = (key: string, value: any) => {
  const jsonValue = JSON.stringify(value);
  const encryptedValue = CryptoJS.AES.encrypt(jsonValue, secretKey).toString();
  localStorage.setItem(key, encryptedValue);
};

export const secureGetItem = (key: string) => {
  const encryptedValue = localStorage.getItem(key);
  if (encryptedValue) {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedValue, secretKey);
      const decryptedValue = bytes.toString(CryptoJS.enc.Utf8);
      if (decryptedValue) {
        try {
          return JSON.parse(decryptedValue);
        } catch (jsonParseError) {
          console.error(
            `Error parsing decrypted data for key: ${key}. Data might be corrupted or not valid JSON.`,
            jsonParseError
          );
          return null;
        }
      } else {
        console.error(
          `Failed to decrypt data for key: ${key}. The data might be corrupted or the key is incorrect.`
        );
        return null;
      }
    } catch (error) {
      console.error(
        `Error during decryption for key: ${key}. Data might be legacy, unencrypted, or corrupted.`,
        error
      );
      // Attempt to parse as plain JSON as a fallback for legacy data
      try {
        return JSON.parse(encryptedValue);
      } catch (jsonError) {
        console.error(
          `Failed to parse both encrypted and plain data for key: ${key}`,
          jsonError
        );
        return null;
      }
    }
  }
  return null;
};
