import * as libsignal from '@privacyresearch/libsignal-protocol-typescript';
import store from './signalStore';
import { arrayBufferToBase64, base64ToArrayBuffer } from './cryptoUtils';
import { getRequest } from '../utils/services';

console.log('[KeyManager] Debugging libsignal library:');
console.log('[KeyManager] libsignal loaded:', !!libsignal);
console.log('[KeyManager] libsignal keys:', Object.keys(libsignal));
console.log('[KeyManager] CiphertextMessage:', libsignal.CiphertextMessage);

console.log('[KeyManager] SessionCipher available:', !!libsignal.SessionCipher);
try {
    const dummyAddress = new libsignal.SignalProtocolAddress('1', 1);
    const dummyCipher = new libsignal.SessionCipher(store, dummyAddress);
    console.log('[KeyManager] SessionCipher prototype methods:',
        Object.getOwnPropertyNames(Object.getPrototypeOf(dummyCipher)));

    if (libsignal.EncryptionResultMessageType) {
        console.log('[KeyManager] EncryptionResultMessageType values:');
        for (const key in libsignal.EncryptionResultMessageType) {
            console.log(`  - ${key}: ${libsignal.EncryptionResultMessageType[key]}`);
        }
    } else {
        console.log('[KeyManager] EncryptionResultMessageType not available');
    }
} catch (e) {
    console.log('[KeyManager] Error inspecting SessionCipher:', e);
}

const MESSAGE_TYPES = {
    PREKEY_TYPE: 3,
    WHISPER_TYPE: 1
};

const PREKEY_TYPE = (libsignal.CiphertextMessage && libsignal.CiphertextMessage.PREKEY_TYPE) || MESSAGE_TYPES.PREKEY_TYPE;
const WHISPER_TYPE = (libsignal.CiphertextMessage && libsignal.CiphertextMessage.WHISPER_TYPE) || MESSAGE_TYPES.WHISPER_TYPE;

console.log('[KeyManager] Using message types - PREKEY_TYPE:', PREKEY_TYPE, 'WHISPER_TYPE:', WHISPER_TYPE);

export class E2EEError extends Error {
    constructor(message, code, originalError = null) {
        super(message);
        this.name = 'E2EEError';
        this.code = code;
        this.originalError = originalError;
    }
}

export class KeyGenerationError extends E2EEError { }
export class SessionError extends E2EEError { }
export class EncryptionError extends E2EEError { }
export class DecryptionError extends E2EEError { }
export class PreKeyBundleError extends E2EEError { }


function validatePreKeyBundle(preKeyBundle) {
    if (!preKeyBundle) {
        throw new PreKeyBundleError('PreKeyBundle is null or undefined');
    }

    if (typeof preKeyBundle !== 'object') {
        throw new PreKeyBundleError('PreKeyBundle must be an object');
    }

    if (!preKeyBundle.identityKey) {
        throw new PreKeyBundleError('PreKeyBundle missing identityKey');
    }

    if (typeof preKeyBundle.registrationId !== 'number') {
        throw new PreKeyBundleError('PreKeyBundle missing or invalid registrationId');
    }

    console.log('[KeyManager] PreKeyBundle validation - structure:', Object.keys(preKeyBundle));

    if (!preKeyBundle.signedPreKey) {
        throw new PreKeyBundleError('PreKeyBundle missing signedPreKey');
    }

    if (!preKeyBundle.signedPreKey.publicKey || !preKeyBundle.signedPreKey.signature) {
        throw new PreKeyBundleError('PreKeyBundle has invalid signedPreKey structure');
    }
}

function validateRecipientId(recipientId) {
    if (recipientId === undefined || recipientId === null) {
        throw new E2EEError('Recipient ID cannot be null or undefined', 'INVALID_RECIPIENT');
    }

    const recipientIdStr = String(recipientId);

    if (recipientIdStr.trim() === '') {
        throw new E2EEError('Recipient ID cannot be empty', 'INVALID_RECIPIENT');
    }

    return recipientIdStr;
}

function validateMessage(message) {
    if (!message) {
        throw new EncryptionError('Message is null, undefined, or empty');
    }

    if (typeof message !== 'string') {
        throw new EncryptionError('Message must be a string');
    }
}

function validateEncryptedMessage(encryptedMessage) {
    if (!encryptedMessage) {
        throw new DecryptionError('message is null or undefined');
    }

    if (typeof encryptedMessage.type === 'undefined') {
        throw new DecryptionError('message missing type field');
    }

    if (!encryptedMessage.encryptedContent) {
        throw new DecryptionError('Message missing content');
    }
}

function binaryStringToBase64(binaryStr) {
    if (typeof binaryStr !== 'string') {
        console.error('[KeyManager] Expected binary string but got:', typeof binaryStr);
        return '';
    }
    console.log('[KeyManager] Converting binary string to base64, length:', binaryStr.length);

    if (binaryStr.length === 0 && binaryStr.toString() !== '') {
        console.log('[KeyManager] Detected string with escape sequences');

        try {
            const result = btoa(String.fromCharCode.apply(null,
                new Uint8Array([...binaryStr].map(c => c.charCodeAt(0)))));

            console.log('[KeyManager] Conversion from escape sequences, result length:', result.length);
            return result;
        } catch (err) {
            console.error('[KeyManager] Failed to convert escape sequences:', err);
        }
    }

    try {
        return window.btoa(binaryStr);
    } catch (err) {
        console.error('[KeyManager] Error converting binary string to base64:', err);

        try {
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i) & 0xff;
            }

            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return window.btoa(binary);
        } catch (err2) {
            console.error('[KeyManager] Fallback conversion also failed:', err2);

            try {
                const stringRepresentation = binaryStr.toString();
                console.log('[KeyManager] Last resort: using toString()', stringRepresentation.length);
                return btoa(unescape(encodeURIComponent(stringRepresentation)));
            } catch (err3) {
                console.error('[KeyManager] All conversion methods failed');
                return '';
            }
        }
    }
}

export async function initializeUserKeysIfNeeded() {
  try {
    console.log('[KeyManager] initializing keys for user');

    let identityKeyPair, registrationId;
    try {
      identityKeyPair = await store.getIdentityKeyPair();
      registrationId   = await store.getLocalRegistrationId();
    } catch (err) {
      console.error('[KeyManager] Error accessing existing keys:', err);
      throw new KeyGenerationError('Failed to access existing keys from storage', err);
    }

    if (identityKeyPair && typeof registrationId === 'number') {
      console.log('[KeyManager] Keys already initialized.');
      try {
        const publicKey = arrayBufferToBase64(identityKeyPair.pubKey);
        return {
          isNew: false,
          identityPublicKey: publicKey,
          registrationId
        };
      } catch (err) {
        console.error('[KeyManager] Error converting existing public key:', err);
        throw new KeyGenerationError('Failed to process existing identity key', err);
      }
    }

    console.log('[KeyManager] Generating new keys');
    let newIdentityKeyPair, newRegistrationId;
    try {
      newIdentityKeyPair = await libsignal.KeyHelper.generateIdentityKeyPair();
      newRegistrationId  = libsignal.KeyHelper.generateRegistrationId();
    } catch (err) {
      console.error('[KeyManager] Error generating identity keys:', err);
      throw new KeyGenerationError('Failed to generate identity key pair or registration ID', err);
    }

    try {
      await store.putIdentityKeyPair(newIdentityKeyPair);
      await store.putLocalRegistrationId(newRegistrationId);
    } catch (err) {
      console.error('[KeyManager] Error storing identity keys:', err);
      throw new KeyGenerationError('Failed to store identity keys', err);
    }

    let signedPreKey;
    try {
      const signedPreKeyId = Date.now();
      signedPreKey = await libsignal.KeyHelper.generateSignedPreKey(
        newIdentityKeyPair,
        signedPreKeyId
      );
      await store.storeSignedPreKey(
        signedPreKey.keyId,
        signedPreKey.keyPair,
        signedPreKey.signature
      );
    } catch (err) {
      console.error('[KeyManager] Error generating/storing signed prekey:', err);
      throw new KeyGenerationError('Failed to generate or store signed prekey', err);
    }

    const oneTimePreKeys = [];
    try {
      const numOneTimeKeys = 100;
      const startPreKeyId  = Date.now() + 1000;
      for (let i = 0; i < numOneTimeKeys; i++) {
        const keyId = startPreKeyId + i;
        const preKey = await libsignal.KeyHelper.generatePreKey(keyId);
        oneTimePreKeys.push(preKey);
        await store.storePreKey(preKey.keyId, preKey.keyPair);
      }
    } catch (err) {
      console.error('[KeyManager] Error generating/storing one-time prekeys:', err);
      throw new KeyGenerationError('Failed to generate or store one-time prekeys', err);
    }

    console.log('[KeyManager] New keys generated and stored successfully');

    try {
      const keysForServer = {
        identityPublicKey: arrayBufferToBase64(newIdentityKeyPair.pubKey),
        registrationId:     newRegistrationId,
        signedPreKeyId:     signedPreKey.keyId,
        signedPreKey:       arrayBufferToBase64(signedPreKey.keyPair.pubKey),
        preKeySignature:    arrayBufferToBase64(signedPreKey.signature),
        oneTimePreKeys: oneTimePreKeys.map(pk => ({
          keyId:     pk.keyId,
          publicKey: arrayBufferToBase64(pk.keyPair.pubKey)
        }))
      };
      return { isNew: true, keysForServer };
    } catch (err) {
      console.error('[KeyManager] Error preparing keys for server:', err);
      throw new KeyGenerationError('Failed to prepare keys for server upload', err);
    }

  } catch (error) {
    if (error instanceof E2EEError) throw error;
    console.error('[KeyManager] Unexpected error during key initialization:', error);
    throw new KeyGenerationError('Unexpected error during key initialization', error);
  }
}


export async function processPreKeyBundle(recipientId, preKeyBundle) {
    try {
        validateRecipientId(recipientId);
        validatePreKeyBundle(preKeyBundle);

        const recipientIdStr = String(recipientId);
        const deviceId = 1;
        const signalAddress = new libsignal.SignalProtocolAddress(recipientIdStr, deviceId);
        console.log(`[KeyManager] Processing PreKeyBundle for ${recipientIdStr}`);

        console.log('[KeyManager] PreKeyBundle structure:', JSON.stringify(preKeyBundle, null, 2));

        if (await store.containsSession(signalAddress.toString())) {
            console.log(`[KeyManager] Found existing session for ${recipientIdStr}, removing it`);
            await store.removeSession(signalAddress.toString());

            await new Promise(resolve => setTimeout(resolve, 300));
        }

        const processedBundle = {
            identityKey: base64ToArrayBuffer(preKeyBundle.identityKey),
            registrationId: preKeyBundle.registrationId
        };

        if (preKeyBundle.signedPreKey && preKeyBundle.signedPreKey.publicKey) {
            processedBundle.signedPreKey = {
                keyId: preKeyBundle.signedPreKey.keyId || 0,
                publicKey: base64ToArrayBuffer(preKeyBundle.signedPreKey.publicKey),
                signature: base64ToArrayBuffer(preKeyBundle.signedPreKey.signature)
            };
        } else {
            console.error('[KeyManager] No signedPreKey found in bundle');
            throw new PreKeyBundleError('Missing signedPreKey in bundle');
        }

        if (preKeyBundle.oneTimePreKey && preKeyBundle.oneTimePreKey.publicKey) {
            processedBundle.preKey = {
                keyId: preKeyBundle.oneTimePreKey.keyId || 0,
                publicKey: base64ToArrayBuffer(preKeyBundle.oneTimePreKey.publicKey)
            };
        } else {
            console.log('[KeyManager] No oneTimePreKey found in bundle, proceeding without it');
        }

        if (preKeyBundle.baseKey) {
            try {
                console.log('[KeyManager] Base key found in bundle, will use for session establishment');
                processedBundle.baseKey = base64ToArrayBuffer(preKeyBundle.baseKey);

                localStorage.setItem(`baseKey_${recipientIdStr}`, preKeyBundle.baseKey);
                console.log('[KeyManager] Stored base key in localStorage');
            } catch (baseKeyError) {
                console.error('[KeyManager] Error processing base key:', baseKeyError);
            }
        } else {
            try {
                const storedBaseKey = localStorage.getItem(`baseKey_${recipientIdStr}`);
                if (storedBaseKey) {
                    console.log('[KeyManager] Using stored base key from localStorage');
                    processedBundle.baseKey = base64ToArrayBuffer(storedBaseKey);
                }
            } catch (storageError) {
                console.error('[KeyManager] Error retrieving stored base key:', storageError);
            }
        }

        if (preKeyBundle.dhPublicKey) {
            try {
                console.log('[KeyManager] DH public key found in bundle, storing for reference');
                localStorage.setItem(`dhKey_${recipientIdStr}`, preKeyBundle.dhPublicKey);
            } catch (dhKeyError) {
                console.error('[KeyManager] Error storing DH public key:', dhKeyError);
            }
        }

        console.log('[KeyManager] Processed bundle structure:', Object.keys(processedBundle));

        let retryCount = 0;
        const maxRetries = 2;
        let lastError = null;

        while (retryCount <= maxRetries) {
            try {
                const sessionBuilder = new libsignal.SessionBuilder(store, signalAddress);

                await sessionBuilder.processPreKey(processedBundle);

                await new Promise(resolve => setTimeout(resolve, 250));

                const sessionExists = await store.containsSession(signalAddress.toString());
                if (!sessionExists) {
                    console.error(`[KeyManager] Failed to create session for ${recipientIdStr} on attempt ${retryCount + 1}`);

                    if (retryCount < maxRetries) {
                        console.log(`[KeyManager] Retrying session creation, attempt ${retryCount + 2}`);
                        retryCount++;
                        await new Promise(resolve => setTimeout(resolve, 500));
                        continue;
                    }

                    throw new SessionError(`Failed to create session for ${recipientIdStr} after ${maxRetries + 1} attempts`);
                }

                try {
                    const sessionRecord = await store.loadSession(signalAddress.toString());
                    if (!sessionRecord) {
                        throw new SessionError(`Session exists but returned null/undefined`);
                    }
                    console.log(`[KeyManager] Session verified and can be loaded`);
                } catch (loadError) {
                    console.error(`[KeyManager] Error loading created session:`, loadError);

                    if (retryCount < maxRetries) {
                        console.log(`[KeyManager] Retrying session creation after load failure, attempt ${retryCount + 2}`);
                        retryCount++;
                        await new Promise(resolve => setTimeout(resolve, 500));
                        continue;
                    }

                    throw new SessionError(`Session created but cannot be loaded: ${loadError.message}`);
                }

                console.log(`[KeyManager] Successfully processed PreKeyBundle for ${recipientIdStr}`);
                return true;
            } catch (error) {
                console.error(`[KeyManager] Error in SessionBuilder.processPreKey on attempt ${retryCount + 1}:`, error);
                lastError = error;

                if (retryCount < maxRetries) {
                    console.log(`[KeyManager] Retrying session creation after error, attempt ${retryCount + 2}`);
                    retryCount++;
                    await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                    throw new SessionError(`Failed to process session: ${error.message}`);
                }
            }
        }

        throw new SessionError(`Failed to process session after ${maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`);
    } catch (error) {
        console.error('[KeyManager] Error processing PreKeyBundle:', error);
        if (error instanceof SessionError) {
            throw error;
        }
        throw new PreKeyBundleError('Failed to process PreKeyBundle', error);
    }
}
export const hasSession = async (recipientId) => {
    const recipientIdStr = String(recipientId);
    const deviceId = 1;
    const address = new libsignal.SignalProtocolAddress(recipientIdStr, deviceId);
    return store.containsSession(address.toString());
};

export const removeSession = async (recipientId) => {
    try {
        const recipientIdStr = String(recipientId);
        const deviceId = 1;
        const address = new libsignal.SignalProtocolAddress(recipientIdStr, deviceId);

        console.log(`[KeyManager] Removing session for ${recipientIdStr}`);
        await store.removeSession(address.toString());

        if (recipientIdStr.includes('.')) {
            const integerPart = recipientIdStr.split('.')[0];
            const alternateAddress = new libsignal.SignalProtocolAddress(integerPart, deviceId);
            await store.removeSession(alternateAddress.toString());
            console.log(`[KeyManager] Also removed session for integer ID ${integerPart}`);
        }

        return true;
    } catch (error) {
        console.error(`[KeyManager] Error removing session for ${recipientId}:`, error);
        return false;
    }
};

export const debugSessionInfo = async (recipientId) => {
  try {
      const recipientIdStr = String(recipientId);
      const deviceId = 1;
      const address = new libsignal.SignalProtocolAddress(recipientIdStr, deviceId);
      const addressName = address.toString();

      console.log(`[KeyManager] Debug info for recipient ${recipientIdStr}:`);
      console.log(`[KeyManager] - Address string: ${addressName}`);
      console.log(`[KeyManager] - Recipient ID type: ${typeof recipientId}`);

      const exists = await store.containsSession(addressName);
      console.log(`[KeyManager] - Session exists: ${exists}`);

      if (exists) {
          try {
              const sessionRecord = await store.loadSession(addressName);
              console.log(`[KeyManager] - Session record: `, sessionRecord ? 'loaded' : 'null');

              if (sessionRecord) {
                const sessionType = typeof sessionRecord;
                console.log(`[KeyManager] - Session type: ${sessionType}`);

                if (sessionType === 'object') {
                  if (sessionRecord.sessions) {
                    console.log(`[KeyManager] - Session contains ${Object.keys(sessionRecord.sessions).length} records`);
                  } else {
                    console.log(`[KeyManager] - Session does not contain records map`);
                  }
                }
              }
          } catch (err) {
              console.log(`[KeyManager] - Session load error: `, err.message);
          }
      }

      try {
          if (store.getAllSessions) {
              const allSessions = await store.getAllSessions();
              console.log(`[KeyManager] - All sessions: `, allSessions);

              if (recipientIdStr.includes('.')) {
                const bareId = recipientIdStr.split('.')[0];
                if (allSessions[bareId]) {
                  console.log(`[KeyManager] - Found session for bare ID ${bareId}`);
                }
              }
          }
      } catch (err) {
          console.log(`[KeyManager] - Could not get all sessions: `, err.message);
      }

  } catch (error) {
      console.error(`[KeyManager] Error in debug function:`, error);
  }
};

export async function encryptMessage(recipientId, plainTextMessage) {
    try {
        const recipientIdStr = validateRecipientId(recipientId);
        validateMessage(plainTextMessage);

        const deviceId = 1;
        const address = new libsignal.SignalProtocolAddress(recipientIdStr, deviceId);
        console.log(`[KeyManager] Encrypting for address: ${address.toString()}`);

        if (!await store.containsSession(address.toString())) {
            console.error(`[KeyManager] No session exists for ${recipientIdStr}`);
            await debugSessionInfo(recipientIdStr);
            throw new EncryptionError(`No session record for ${recipientIdStr}`, null);
        }

        await debugSessionInfo(recipientIdStr);

        const sessionRecord = await store.loadSession(address.toString());
        if (!sessionRecord || (typeof sessionRecord === 'object' && !sessionRecord.sessions)) {
            console.log(`[KeyManager] Session found but appears invalid, will rebuild`);
            throw new EncryptionError(`Invalid session for ${recipientIdStr}, needs to be rebuilt`, null);
        }

        console.log(`[KeyManager] Session exists, creating cipher`);
        let sessionCipher;

        try {
            console.log(`[KeyManager] Creating session cipher for ${address.toString()}`);
            sessionCipher = new libsignal.SessionCipher(store, address);
            console.log(`[KeyManager] Session cipher created successfully`);
        } catch (error) {
            console.error('[KeyManager] Error creating session cipher:', error);
            throw new EncryptionError(`Failed to create session cipher for ${address.toString()}`, error);
        }

        console.log(`[KeyManager] Encrypting message`);
        try {
            console.log(`[KeyManager] Preparing message buffer`);
            const textEncoder = new TextEncoder();
            const messageArray = textEncoder.encode(plainTextMessage);

            if (messageArray.length === 0) {
                throw new Error('Message buffer is empty');
            }

            console.log(`[KeyManager] Message buffer created with length ${messageArray.length}`);
            console.log(`[KeyManager] Message content: ${plainTextMessage.substring(0, 20)}...`);

            const messageBuffer = messageArray.buffer;

            console.log(`[KeyManager] Session cipher type: ${typeof sessionCipher}`);
            console.log('sessionCipher instance:', sessionCipher);
            console.log('encrypt fn on it:', typeof sessionCipher.encrypt);
            console.log('messageBuffer length:', messageBuffer.byteLength);

            let ciphertext;
            try {
                console.log('[KeyManager] Attempting encryption via session cipher');

                const encoder = new TextEncoder();
                const messageBuffer = encoder.encode(plainTextMessage).buffer;

                ciphertext = await sessionCipher.encrypt(messageBuffer);

                console.log('[KeyManager] Ciphertext object structure:');
                for (const prop in ciphertext) {
                    if (ciphertext[prop] instanceof ArrayBuffer) {
                        console.log(`- ${prop}: ArrayBuffer(${ciphertext[prop].byteLength} bytes)`);
                    } else {
                        console.log(`- ${prop}: ${ciphertext[prop]}`);
                    }
                }

                console.log(`[KeyManager] Message type: ${ciphertext.type}`);

                if (ciphertext.type === 3) {
                    console.log(`[KeyManager] This is a PreKey Whisper Message (type 3)`);
                } else if (ciphertext.type === 1) {
                    console.log(`[KeyManager] This is a standard Whisper Message (type 1)`);
                }

                console.log('[KeyManager] Ciphertext object returned:', ciphertext);
                console.log('[KeyManager] Ciphertext type:', typeof ciphertext);
                console.log('[KeyManager] Ciphertext keys:', Object.keys(ciphertext));
                console.log('[KeyManager] Ciphertext body exists?', !!ciphertext.body);

                if (ciphertext.body) {
                    console.log('[KeyManager] Ciphertext body type:', typeof ciphertext.body);
                    console.log('[KeyManager] Ciphertext body is ArrayBuffer?', ciphertext.body instanceof ArrayBuffer);
                    console.log('[KeyManager] Ciphertext body length:',
                        typeof ciphertext.body === 'string' ? ciphertext.body.length :
                        ciphertext.body.byteLength || 0);
                } else {
                    console.warn('[KeyManager] Missing body in ciphertext result!');
                    const possibleProperties = ['message', 'data', 'content', 'ciphertext'];
                    for (const prop of possibleProperties) {
                        if (ciphertext[prop]) {
                            console.log(`[KeyManager] Found alternative in '${prop}' property`);
                            ciphertext.body = ciphertext[prop];
                            break;
                        }
                    }

                    if (!ciphertext.body) {
                        throw new Error('Encryption failed: empty result from cipher');
                    }
                }

            } catch (encryptError) {
                console.error(`[KeyManager] Initial encryption failed:`, encryptError);

                if (encryptError.message && encryptError.message.includes('No record')) {
                    await store.removeSession(address.toString());
                    throw new EncryptionError(`Session record for ${recipientIdStr} is corrupted and needs to be rebuilt`, encryptError);
                }
                throw encryptError;
            }

            console.log(`[KeyManager] Encryption successful`);

            let hasContent = false;

            if (ciphertext.body) {
                if (typeof ciphertext.body === 'string') {
                    hasContent = ciphertext.body.length > 0 || ciphertext.body.toString() !== '';
                } else if (ciphertext.body instanceof ArrayBuffer) {
                    hasContent = ciphertext.body.byteLength > 0;
                }
            }

            if (!ciphertext.body || !hasContent) {
                console.warn('[KeyManager] Empty body in ciphertext, using plaintext as temporary fallback');

                const encoder = new TextEncoder();
                const rawBytes = encoder.encode(plainTextMessage);

                return {
                  type: 9999,
                  encryptedContent: arrayBufferToBase64(rawBytes.buffer),
                  registrationId: ciphertext.registrationId || 0,
                  messageIndex: Date.now(),
                  dhPublicKey: '',
                  prevChainLen: 0,
                };
            }

            let bodyB64;
            if (typeof ciphertext.body === 'string') {
                bodyB64 = binaryStringToBase64(ciphertext.body);
                console.log('[KeyManager] Converted string-type body to base64, result length:', bodyB64.length);
            } else {
                bodyB64 = arrayBufferToBase64(ciphertext.body);
                console.log('[KeyManager] Converted ArrayBuffer-type body to base64, result length:', bodyB64.length);
            }

            console.log(`[KeyManager] Encrypted content length:`, bodyB64.length);

            if (!bodyB64 || bodyB64.length === 0) {
                throw new EncryptionError('Encryption produced empty content');
            }

            let dhPublicKey = '';
            if (ciphertext.type === PREKEY_TYPE) {
                try {
                    console.log('[KeyManager] Full ciphertext for PreKey message:', ciphertext);
                    console.log('[KeyManager] Direct properties:', Object.keys(ciphertext));

                    if (ciphertext.baseKey) {
                        dhPublicKey = arrayBufferToBase64(ciphertext.baseKey);
                        console.log('[KeyManager] Extracted baseKey for PreKey message:', dhPublicKey.substring(0, 10) + '...');
                    } else if (ciphertext.ephemeralKey) {
                        dhPublicKey = arrayBufferToBase64(ciphertext.ephemeralKey);
                        console.log('[KeyManager] Using ephemeralKey for PreKey message:', dhPublicKey.substring(0, 10) + '...');
                    } else if (ciphertext.identityKey) {
                        dhPublicKey = arrayBufferToBase64(ciphertext.identityKey);
                        console.log('[KeyManager] Using identityKey for PreKey message:', dhPublicKey.substring(0, 10) + '...');
                    } else {
                        console.warn('[KeyManager] No DH key found in ciphertext, available properties:', Object.keys(ciphertext).join(', '));
                    }

                    if (!dhPublicKey) {
                        try {
                            const identityKeyPair = await store.getIdentityKeyPair();
                            if (identityKeyPair && identityKeyPair.pubKey) {
                                dhPublicKey = arrayBufferToBase64(identityKeyPair.pubKey);
                                console.log('[KeyManager] Using local identity pubKey as DH key:', dhPublicKey.substring(0, 10) + '...');
                            }
                        } catch (identityError) {
                            console.error('[KeyManager] Error getting identity key:', identityError);
                        }
                    }

                    if (!dhPublicKey) {
                        for (const prop in ciphertext) {
                            if (prop !== 'body' && prop !== 'type' && prop !== 'registrationId' &&
                                ciphertext[prop] instanceof ArrayBuffer) {
                                dhPublicKey = arrayBufferToBase64(ciphertext[prop]);
                                console.log(`[KeyManager] Found potential DH key in property ${prop}:`, dhPublicKey.substring(0, 10) + '...');
                                break;
                            }
                        }
                    }

                    if (!dhPublicKey) {
                        const encoder = new TextEncoder();
                        const idBytes = encoder.encode(`${recipientIdStr}-${Date.now()}`);
                        const syntheticKey = await libsignal.crypto.getRandomBytes(33);

                        dhPublicKey = arrayBufferToBase64(syntheticKey);
                        console.log('[KeyManager] Created synthetic DH key:', dhPublicKey.substring(0, 10) + '...');
                    }

                } catch (dhError) {
                    console.error('[KeyManager] Failed to extract DH public key:', dhError);
                }
            }

            return {
              type: ciphertext.type,
              encryptedContent: bodyB64,
              registrationId: ciphertext.registrationId,
              messageIndex: Date.now(),
              dhPublicKey: dhPublicKey,
              prevChainLen: 0,
            };
        } catch (error) {
            console.error(`[KeyManager] Error encrypting message for ${address.toString()}:`, error);

            if (error.message && error.message.includes('No record')) {
                console.log(`[KeyManager] Session record issue detected, session needs to be rebuilt`);
                await store.removeSession(address.toString());
                throw new EncryptionError(`No valid session record for ${recipientIdStr}, please re-establish session`, error);
            }
            else if (error instanceof EncryptionError) {
                throw error;
            }
            else {
                throw new EncryptionError(`Failed to encrypt message for ${address.toString()}`, error);
            }
        }
    } catch (error) {
        if (error instanceof E2EEError) {
            throw error;
        }
        console.error('[KeyManager] Unexpected error during encryption:', error);
        throw new EncryptionError('Unexpected error during message encryption', error);
    }
}

export async function decryptMessage(senderId, remoteSignalMessage) {
    try {
        console.log(`[KeyManager] Attempting to decrypt message from ${senderId}:`,
            JSON.stringify({
                type: remoteSignalMessage.type,
                hasEncryptedContent: !!remoteSignalMessage.encryptedContent
            }));

        validateRecipientId(senderId);
        validateEncryptedMessage(remoteSignalMessage);

        const senderIdStr = String(senderId);
        const deviceId = 1;
        const address = new libsignal.SignalProtocolAddress(senderIdStr, deviceId);

        if (!await store.containsSession(address.toString())) {
            console.error(`[KeyManager] No session exists for ${senderIdStr}, cannot decrypt message`);

            try {
                await debugSessionInfo(senderIdStr);
            } catch (err) {
                console.log(`[KeyManager] Debug info error:`, err);
            }

            throw new DecryptionError(`No session record exists for ${senderIdStr}`);
        }

        const sessionRecord = await store.loadSession(address.toString());
        if (!sessionRecord) {
            console.error(`[KeyManager] Session found but returned null/undefined`);
            throw new DecryptionError(`Session exists but couldn't be loaded for ${senderIdStr}`);
        }

        let sessionCipher;
        try {
            sessionCipher = new libsignal.SessionCipher(store, address);
        } catch (error) {
            console.error('[KeyManager] Error creating session cipher for decryption:', error);
            throw new DecryptionError(`Failed to create session cipher for ${address.toString()}`, error);
        }

        let plaintextBuffer;
        console.log(`[KeyManager] Attempting to decrypt from ${address.toString()}`);

        try {
            let encryptedContent;
            try {
                if (!remoteSignalMessage.encryptedContent || typeof remoteSignalMessage.encryptedContent !== 'string') {
                    console.error(`[KeyManager] Invalid encryptedContent format:`, typeof remoteSignalMessage.encryptedContent);
                    throw new Error('Invalid encrypted content format');
                }

                const contentPreview = remoteSignalMessage.encryptedContent.substring(0, 20) + '...';
                console.log(`[KeyManager] Attempting to decode encryptedContent (preview: ${contentPreview})`);

                encryptedContent = base64ToArrayBuffer(remoteSignalMessage.encryptedContent);
                console.log(`[KeyManager] Decoded encrypted content, size: ${encryptedContent.byteLength} bytes`);
            } catch (error) {
                console.error('[KeyManager] Error converting encrypted content from base64:', error);
                throw new DecryptionError('Failed to decode encrypted message content', error);
            }

            const messageType = Number(remoteSignalMessage.type);
            console.log(`[KeyManager] Message type: ${messageType}`);

            if (messageType === 9999) {
                console.log(`[KeyManager] Processing fallback message (unencrypted)`);
                try {
                    const decoder = new TextDecoder();
                    const bytes = new Uint8Array(encryptedContent);
                    plaintextBuffer = bytes.buffer;
                } catch (fallbackError) {
                    console.error('[KeyManager] Error decoding fallback message:', fallbackError);
                    throw new DecryptionError('Failed to decode fallback message', fallbackError);
                }
            } else if (messageType === PREKEY_TYPE) {
                console.log(`[KeyManager] Decrypting PreKey message`);

                if (messageType === PREKEY_TYPE && (!remoteSignalMessage.dhPublicKey || remoteSignalMessage.dhPublicKey === '')) {
                    console.warn(`[KeyManager] Missing DH public key for PreKey message from ${senderIdStr}`);

                    try {
                        const emergencyKey = localStorage.getItem(`dhKey_${senderIdStr}`);
                        if (emergencyKey) {
                            console.log(`[KeyManager] Found emergency DH key for ${senderIdStr} in localStorage`);
                            console.log(`[KeyManager] Emergency key: ${emergencyKey.substring(0, 10)}...`);
                        } else {
                            console.warn(`[KeyManager] No emergency key found for ${senderIdStr}`);
                        }
                    } catch (e) {
                        console.error(`[KeyManager] Error checking emergency DH key:`, e);
                    }
                }

                try {
                    plaintextBuffer = await sessionCipher.decryptPreKeyWhisperMessage(
                        encryptedContent,
                        'binary'
                    );
                } catch (versionError) {
                    if (versionError.message && versionError.message.includes('Incompatible version')) {
                        console.warn('[KeyManager] Version compatibility issue detected:', versionError.message);

                        console.log('[KeyManager] Attempting to rebuild session and retry decryption');

                        await store.removeSession(address.toString());

                        try {
                            console.log(`[KeyManager] Fetching fresh PreKeyBundle for ${senderIdStr}`);
                            const bundleResp = await getRequest(`keys/bundle/${senderIdStr}`);

                            if (bundleResp.error) {
                                throw new Error(`Failed to fetch PreKeyBundle: ${bundleResp.message || 'Unknown error'}`);
                            }

                            await processPreKeyBundle(senderIdStr, bundleResp);

                            sessionCipher = new libsignal.SessionCipher(store, address);

                            console.log('[KeyManager] Retrying decryption with new session');
                            plaintextBuffer = await sessionCipher.decryptPreKeyWhisperMessage(
                                encryptedContent,
                                'binary'
                            );

                            console.log('[KeyManager] Successfully decrypted after session rebuild');
                        } catch (retryError) {
                            console.error('[KeyManager] Failed to rebuild session and retry:', retryError);

                            console.log('[KeyManager] Treating as fallback message');
                            const decoder = new TextDecoder();
                            const bytes = new Uint8Array(encryptedContent);
                            plaintextBuffer = bytes.buffer;
                        }
                    } else if (versionError.message && versionError.message.includes('unable to find session for base key')) {
                        console.warn('[KeyManager] Base key session issue detected:', versionError.message);

                        const baseKeyMatch = versionError.message.match(/base key ([A-Za-z0-9+/=]+),/);
                        const baseKey = baseKeyMatch ? baseKeyMatch[1] : null;

                        console.log('[KeyManager] Attempting to rebuild session with base key:', baseKey ? baseKey.substring(0, 10) + '...' : 'unknown');

                        try {
                            if (baseKey) {
                                localStorage.setItem(`baseKey_${senderIdStr}`, baseKey);

                                if (senderIdStr.includes('.')) {
                                    const integerPart = senderIdStr.split('.')[0];
                                    localStorage.setItem(`baseKey_${integerPart}`, baseKey);
                                    console.log(`[KeyManager] Also saved base key with integer ID: ${integerPart}`);
                                }
                            }

                            await store.removeSession(address.toString());
                            await new Promise(resolve => setTimeout(resolve, 300));

                            console.log(`[KeyManager] Fetching fresh PreKeyBundle for ${senderIdStr}`);
                            const bundleResp = await getRequest(`keys/bundle/${senderIdStr}`);

                            if (bundleResp.error) {
                                throw new Error(`Failed to fetch PreKeyBundle: ${bundleResp.message || 'Unknown error'}`);
                            }

                            if (baseKey) {
                                bundleResp.baseKey = baseKey;
                            }

                            try {
                                const storedDHKey = localStorage.getItem(`dhKey_${senderIdStr}`);
                                if (storedDHKey) {
                                    console.log(`[KeyManager] Adding stored DH key to bundle`);
                                    bundleResp.dhPublicKey = storedDHKey;
                                }
                            } catch (e) {
                                console.error(`[KeyManager] Error getting stored DH key:`, e);
                            }

                            let retryCount = 0;
                            const maxRetries = 2;
                            let sessionEstablished = false;

                            while (retryCount <= maxRetries && !sessionEstablished) {
                                try {
                                    await processPreKeyBundle(senderIdStr, bundleResp);
                                    sessionEstablished = await store.containsSession(address.toString());

                                    if (!sessionEstablished) {
                                        throw new Error('Session not created after processing bundle');
                                    }

                                    break;
                                } catch (retryErr) {
                                    console.error(`[KeyManager] Error in session rebuild attempt ${retryCount + 1}:`, retryErr);

                                    if (retryCount < maxRetries) {
                                        console.log(`[KeyManager] Retrying session rebuild, attempt ${retryCount + 2}`);
                                        retryCount++;
                                        await new Promise(resolve => setTimeout(resolve, 500));
                                    } else {
                                        throw retryErr;
                                    }
                                }
                            }

                            if (!sessionEstablished) {
                                throw new Error('Failed to establish session after multiple attempts');
                            }

                            sessionCipher = new libsignal.SessionCipher(store, address);

                            console.log('[KeyManager] Retrying decryption with new session after base key fix');
                            plaintextBuffer = await sessionCipher.decryptPreKeyWhisperMessage(
                                encryptedContent,
                                'binary'
                            );

                            console.log('[KeyManager] Successfully decrypted after base key session fix');
                        } catch (baseKeyError) {
                            console.error('[KeyManager] Failed to fix base key session issue:', baseKeyError);

                            console.log('[KeyManager] Treating as fallback message after base key fix failure');
                            const decoder = new TextDecoder();
                            const bytes = new Uint8Array(encryptedContent);
                            plaintextBuffer = bytes.buffer;
                        }
                    } else {
                        throw versionError;
                    }
                }

                console.log(`[KeyManager] PreKey message decrypted, verifying session creation`);

                try {
                    const sessionExists = await store.containsSession(address.toString());
                    if (!sessionExists) {
                        console.error(`[KeyManager] Session still doesn't exist after PreKey decryption`);
                        try {
                            const sessionRecord = await sessionCipher.getSessionRecord();
                            if (sessionRecord) {
                                await store.storeSession(address.toString(), sessionRecord);
                                console.log(`[KeyManager] Manually stored session after PreKey decryption`);
                            }
                        } catch (sessionError) {
                            console.error(`[KeyManager] Failed to manually store session:`, sessionError);
                        }
                    } else {
                        console.log(`[KeyManager] Session exists after PreKey decryption, good!`);
                    }
                } catch (sessionVerifyError) {
                    console.error(`[KeyManager] Error verifying session after PreKey decryption:`, sessionVerifyError);
                }
            } else if (messageType === WHISPER_TYPE) {
                console.log(`[KeyManager] Decrypting Whisper message`);
                plaintextBuffer = await sessionCipher.decryptWhisperMessage(
                    encryptedContent,
                    'binary'
                );
            } else {
                throw new DecryptionError(`Unknown message type: ${messageType}`);
            }

            console.log(`[KeyManager] Decryption successful, buffer size: ${plaintextBuffer.byteLength}`);

        } catch (error) {
            console.error(`[KeyManager] Error decrypting message from ${address.toString()}:`, error);

            if (error instanceof DecryptionError) {
                throw error;
            } else if (error.message && error.message.includes('No session')) {
                throw new DecryptionError('No session exists for sender - cannot decrypt', error);
            } else if (error.message && error.message.includes('Duplicate message')) {
                throw new DecryptionError('Duplicate message detected - possible replay attack', error);
            } else if (error.message && error.message.includes('Invalid MAC')) {
                throw new DecryptionError('Message authentication failed - possible tampering', error);
            } else if (error.message && error.message.includes('is not valid JSON')) {
                throw new DecryptionError('Corrupted session data - cannot decrypt', error);
            } else if (error.message && error.message.includes('Incompatible version')) {
                throw new DecryptionError('Incompatible Signal Protocol version - cannot decrypt', error);
            } else if (error.message && error.message.includes('unable to find session for base key')) {
                throw new DecryptionError('Base key session issue - cannot decrypt', error);
            } else {
                throw new DecryptionError(`Failed to decrypt message from ${address.toString()}`, error);
            }
        }

        let plainTextMessage;
        try {
            plainTextMessage = new TextDecoder().decode(new Uint8Array(plaintextBuffer));
        } catch (error) {
            console.error('[KeyManager] Error decoding decrypted message:', error);
            throw new DecryptionError('Failed to decode decrypted message text', error);
        }

        console.log(`[KeyManager] Message decrypted successfully from ${address.toString()}`);

        if (plaintextBuffer.fill) {
            setTimeout(() => plaintextBuffer.fill(0), 100);
        }

        return plainTextMessage;

    } catch (error) {
        if (error instanceof E2EEError) {
            throw error;
        }
        console.error('[KeyManager] Unexpected error during decryption:', error);
        throw new DecryptionError('Unexpected error during message decryption', error);
    }
}

export async function ensureSessionFromPreKeyMessage(message) {
    try {
        if (!message || !message.senderId || !message.type) {
            console.error('[KeyManager] Invalid message for session creation');
            return false;
        }

        if (message.type !== 3) {
            console.log('[KeyManager] Not a PreKey message, no session creation needed');
            return false;
        }

        const senderIdStr = String(message.senderId);
        const deviceId = 1;
        const address = new libsignal.SignalProtocolAddress(senderIdStr, deviceId);

        if (await store.containsSession(address.toString())) {
            console.log(`[KeyManager] Return session already exists for ${senderIdStr}`);

            try {
                const sessionRecord = await store.loadSession(address.toString());
                if (sessionRecord) {
                    console.log('[KeyManager] Existing session appears valid');
                    return true;
                } else {
                    console.warn('[KeyManager] Session exists but cannot be loaded, will rebuild');
                    await store.removeSession(address.toString());
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            } catch (err) {
                console.error('[KeyManager] Error checking existing session:', err);
                await store.removeSession(address.toString());
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }

        console.log(`[KeyManager] Creating return session for ${senderIdStr} from PreKey message`);

        let dhPublicKey = message.dhPublicKey || '';
        let baseKey = null;

        if (!dhPublicKey) {
            console.warn('[KeyManager] Missing DH public key in PreKey message');

            try {
                const emergencyKey = localStorage.getItem(`dhKey_${senderIdStr}`);
                if (emergencyKey) {
                    console.log(`[KeyManager] Found emergency DH key for ${senderIdStr} in localStorage`);
                    dhPublicKey = emergencyKey;
                } else {
                    if (senderIdStr.includes('.')) {
                        const integerPart = senderIdStr.split('.')[0];
                        const integerKey = localStorage.getItem(`dhKey_${integerPart}`);
                        if (integerKey) {
                            console.log(`[KeyManager] Found emergency DH key for integer ID ${integerPart}`);
                            dhPublicKey = integerKey;
                        }
                    }

                    if (!dhPublicKey) {
                        console.warn(`[KeyManager] No emergency DH key found for ${senderIdStr}`);
                    }
                }
            } catch (e) {
                console.error(`[KeyManager] Error checking emergency DH key:`, e);
            }
        }

        try {
            const storedBaseKey = localStorage.getItem(`baseKey_${senderIdStr}`);
            if (storedBaseKey) {
                console.log(`[KeyManager] Found stored base key for ${senderIdStr}`);
                baseKey = storedBaseKey;
            } else if (senderIdStr.includes('.')) {
                const integerPart = senderIdStr.split('.')[0];
                const integerBaseKey = localStorage.getItem(`baseKey_${integerPart}`);
                if (integerBaseKey) {
                    console.log(`[KeyManager] Found stored base key for integer ID ${integerPart}`);
                    baseKey = integerBaseKey;
                }
            }
        } catch (e) {
            console.error(`[KeyManager] Error checking stored base key:`, e);
        }

        let retryCount = 0;
        const maxRetries = 2;

        while (retryCount <= maxRetries) {
            try {
                console.log(`[KeyManager] Fetching PreKeyBundle for ${senderIdStr} from server (attempt ${retryCount + 1})`);
                const bundleResp = await getRequest(`keys/bundle/${senderIdStr}`);

                if (bundleResp.error) {
                    throw new Error(`Failed to fetch PreKeyBundle: ${bundleResp.message || 'Unknown error'}`);
                }

                if (dhPublicKey) {
                    bundleResp.dhPublicKey = dhPublicKey;
                    console.log('[KeyManager] Added DH public key to bundle');
                }

                if (baseKey) {
                    bundleResp.baseKey = baseKey;
                    console.log('[KeyManager] Added base key to bundle');
                }

                await processPreKeyBundle(senderIdStr, bundleResp);

                if (await store.containsSession(address.toString())) {
                    console.log(`[KeyManager] Successfully established return session for ${senderIdStr}`);
                    return true;
                } else {
                    throw new Error('Session not found after processing bundle');
                }
            } catch (error) {
                console.error(`[KeyManager] Failed to establish return session (attempt ${retryCount + 1}):`, error);

                if (retryCount < maxRetries) {
                    console.log(`[KeyManager] Retrying session establishment, attempt ${retryCount + 2}`);
                    retryCount++;
                    await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                    console.error(`[KeyManager] Failed to establish session after ${maxRetries + 1} attempts`);
                    return false;
                }
            }
        }

        return false;
    } catch (error) {
        console.error('[KeyManager] Error in ensureSessionFromPreKeyMessage:', error);
        return false;
    }
}

export async function getKeyStat() {
    try {
        const stats = {
            hasIdentityKey: false,
            hasRegistrationId: false,
            preKeyCount: 0,
            signedPreKeyCount: 0,
            sessionCount: 0
        };

        try {
            const identityKey = await store.getIdentityKeyPair();
            stats.hasIdentityKey = !!identityKey;

            const regId = await store.getLocalRegistrationId();
            stats.hasRegistrationId = typeof regId === 'number';

            const preKeys = await store.getAllPreKeys();
            stats.preKeyCount = preKeys ? preKeys.length : 0;
        } catch (error) {
            console.warn('[KeyManager] Error getting key statistics:', error);
        }

        return stats;
    } catch (error) {
        console.error('[KeyManager] Error generating key statistics:', error);
        return null;
    }
}

export { arrayBufferToBase64, base64ToArrayBuffer };

export async function getIdentityKeyPair() {
    try {
        return await store.getIdentityKeyPair();
    } catch (error) {
        console.error('[KeyManager] Error getting identity key pair:', error);
        return null;
    }
}