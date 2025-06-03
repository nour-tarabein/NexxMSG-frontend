// src/E2EE/keyManager.js
import * as libsignal from 'libsignal-protocol-javascript';
import store from './signalStore'; 
import { arrayBufferToBase64, base64ToArrayBuffer } from './cryptoUtils';


export class E2EEError extends Error {
    constructor(message, code, originalError = null) {
        super(message);
        this.name = 'E2EEError';
        this.code = code;
        this.originalError = originalError;
    }
}

export class KeyGenerationError extends E2EEError {
    constructor(message, originalError = null) {
        super(message, 'KEY_GENERATION_ERROR', originalError);
        this.name = 'KeyGenerationError';
    }
}

export class SessionError extends E2EEError {
    constructor(message, originalError = null) {
        super(message, 'SESSION_ERROR', originalError);
        this.name = 'SessionError';
    }
}

export class EncryptionError extends E2EEError {
    constructor(message, originalError = null) {
        super(message, 'ENCRYPTION_ERROR', originalError);
        this.name = 'EncryptionError';
    }
}

export class DecryptionError extends E2EEError {
    constructor(message, originalError = null) {
        super(message, 'DECRYPTION_ERROR', originalError);
        this.name = 'DecryptionError';
    }
}

export class PreKeyBundleError extends E2EEError {
    constructor(message, originalError = null) {
        super(message, 'PREKEY_BUNDLE_ERROR', originalError);
        this.name = 'PreKeyBundleError';
    }
}


function validatePreKeyBundle(preKeyBundle) {
    if (!preKeyBundle) {
        throw new PreKeyBundleError('Pre Key bundle is null');
    }
    
    const required = ['identityPublicKey', 'registrationId', 'signedPreKey'];
    for (const field of required) {
        if (!preKeyBundle[field]) {
            throw new PreKeyBundleError(`Missing required field: ${field}`);
        }
    }
    
    if (!preKeyBundle.signedPreKey.keyId || !preKeyBundle.signedPreKey.publicKey || !preKeyBundle.signedPreKey.signature) {
        throw new PreKeyBundleError('Invalid signed prekey structure');
    }
    
    if (typeof preKeyBundle.registrationId !== 'number') {
        throw new PreKeyBundleError('Registration ID must be a number');
    }
}

function validateRecipientId(recipientId) {
    if (!recipientId && recipientId !== 0) {
        throw new SessionError('Recipient ID is null, undefined, or empty');
    }
    
    if (typeof recipientId !== 'string' && typeof recipientId !== 'number') {
        throw new SessionError('Recipient ID must be a string or number');
    }
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

export async function initializeUserKeysIfNeeded() {
    try {
        console.log('[KeyManager] initializing keys for user');
        
        // check key to make sure it exists
        let identityKeyPair, registrationId;
        
        try {
            identityKeyPair = await store.getIdentityKeyPair();
            registrationId = await store.getLocalRegistrationId();
        } catch (error) {
            console.error('[KeyManager] Error accessing existing keys:', error);
            throw new KeyGenerationError('Failed to access existing keys from storage', error);
        }

        if (identityKeyPair && typeof registrationId === 'number') {
            console.log('[KeyManager] Keys already initialized.');
            
            try {
                const publicKey = arrayBufferToBase64(identityKeyPair.pubKey);
                return {
                    isNew: false,
                    identityPublicKey: publicKey,
                    registrationId: registrationId
                };
            } catch (error) {
                console.error('[KeyManager] Error converting existing public key:', error);
                throw new KeyGenerationError('Failed to process existing identity key', error);
            }
        }

        console.log('[KeyManager] Generating new keys');
        
        let newIdentityKeyPair, newRegistrationId;
        
        try {
            newIdentityKeyPair = await libsignal.KeyHelper.generateIdentityKeyPair();
            newRegistrationId = libsignal.KeyHelper.generateRegistrationId();
        } catch (error) {
            console.error('[KeyManager] Error generating identity keys:', error);
            throw new KeyGenerationError('Failed to generate identity key pair or registration ID', error);
        }

        // store identity of the key
        try {
            await store.putIdentityKeyPair(newIdentityKeyPair);
            await store.putLocalRegistrationId(newRegistrationId);
        } catch (error) {
            console.error('[KeyManager] Error storing identity keys:', error);
            throw new KeyGenerationError('Failed to store identity keys', error);
        }

        let signedPreKey;
        try {
            const signedPreKeyId = Date.now(); 
            signedPreKey = await libsignal.KeyHelper.generateSignedPreKey(
                newIdentityKeyPair,
                signedPreKeyId
            );
            await store.storeSignedPreKey(signedPreKey.keyId, signedPreKey.keyPair, signedPreKey.signature);
        } catch (error) {
            console.error('[KeyManager] Error generating/storing signed prekey:', error);
            throw new KeyGenerationError('Failed to generate or store signed prekey', error);
        }

        let oneTimePreKeys;
        try {
            const numOneTimeKeys = 100;
            const startPreKeyId = Date.now() + 1000; 
            oneTimePreKeys = await libsignal.KeyHelper.generatePreKeys(
                startPreKeyId,
                numOneTimeKeys
            );
            
            const storePromises = oneTimePreKeys.map(preKey => 
                store.storePreKey(preKey.keyId, preKey.keyPair)
            );
            await Promise.all(storePromises);
        } catch (error) {
            console.error('[KeyManager] Error generating/storing one-time prekeys:', error);
            throw new KeyGenerationError('Failed to generate or store one-time prekeys', error);
        }

        console.log('[KeyManager] New keys generated and stored successfully');


        try {
            const publicKeysForServer = {
                identityPublicKey: arrayBufferToBase64(newIdentityKeyPair.pubKey),
                registrationId: newRegistrationId,
                signedPreKeyId: signedPreKey.keyId,
                signedPreKey: arrayBufferToBase64(signedPreKey.keyPair.pubKey),
                preKeySignature: arrayBufferToBase64(signedPreKey.signature),
                oneTimePreKeys: oneTimePreKeys.map(preKey => ({
                    keyId: preKey.keyId,
                    publicKey: arrayBufferToBase64(preKey.keyPair.pubKey),
                })),
            };
            
            return { isNew: true, keysForServer: publicKeysForServer };
        } catch (error) {
            console.error('[KeyManager] Error preparing keys for server:', error);
            throw new KeyGenerationError('Failed to prepare keys for server upload', error);
        }
        
    } catch (error) {
        if (error instanceof E2EEError) {
            throw error;
        }
        console.error('[KeyManager] Unexpected error during key initialization:', error);
        throw new KeyGenerationError('Unexpected error during key initialization', error);
    }
}

export async function processPreKeyBundle(recipientId, preKeyBundle) {
    try {
        validateRecipientId(recipientId);
        validatePreKeyBundle(preKeyBundle);
        
        const deviceId = 1;
        const address = new libsignal.SignalProtocolAddress(recipientId.toString(), deviceId);
        
        let sessionBuilder;
        try {
            sessionBuilder = new libsignal.SessionBuilder(store, address);
        } catch (error) {
            console.error('[KeyManager] Error creating session builder:', error);
            throw new SessionError(`Failed to create session builder for ${address.toString()}`, error);
        }

        let bundleToProcess;
        try {
            bundleToProcess = {
                identityKey: base64ToArrayBuffer(preKeyBundle.identityPublicKey),
                registrationId: preKeyBundle.registrationId,
                signedPreKey: {
                    keyId: preKeyBundle.signedPreKey.keyId,
                    publicKey: base64ToArrayBuffer(preKeyBundle.signedPreKey.publicKey),
                    signature: base64ToArrayBuffer(preKeyBundle.signedPreKey.signature),
                },
            };
            
            if (preKeyBundle.oneTimePreKey) {
                bundleToProcess.preKey = { 
                    keyId: preKeyBundle.oneTimePreKey.keyId,
                    publicKey: base64ToArrayBuffer(preKeyBundle.oneTimePreKey.publicKey),
                };
            }
        } catch (error) {
            console.error('[KeyManager] Error converting prekey bundle keys:', error);
            throw new PreKeyBundleError('Failed to convert prekey bundle keys from base64', error);
        }
        
        console.log(`[KeyManager] Processing preKeyBundle for ${address.toString()}`);
        
        try {
            await sessionBuilder.processPreKeyBundle(bundleToProcess);
            console.log(`[KeyManager] Session established successfully with ${address.toString()}`);
        } catch (error) {
            console.error(`[KeyManager] Error processing prekey bundle for ${address.toString()}:`, error);
            
            if (error.message && error.message.includes('Untrusted identity key')) {
                throw new SessionError('Identity key verification failed - possible MITM attack', error);
            } else if (error.message && error.message.includes('Invalid signature')) {
                throw new SessionError('Invalid prekey signature - corrupted or tampered bundle', error);
            } else {
                throw new SessionError(`Failed to establish session with ${address.toString()}`, error);
            }
        }
        
    } catch (error) {
        if (error instanceof E2EEError) {
            throw error;
        }
        console.error('[KeyManager] Unexpected error processing prekey bundle:', error);
        throw new SessionError('Unexpected error during session establishment', error);
    }
}

export async function encryptMessage(recipientId, plainTextMessage) {
    try {
        validateRecipientId(recipientId);
        validateMessage(plainTextMessage);
        
        const deviceId = 1;
        const address = new libsignal.SignalProtocolAddress(recipientId.toString(), deviceId);

        try {
            const hasSession = await store.containsSession(address.toString());
            if (!hasSession) {
                throw new EncryptionError(`No session exists for ${address.toString()}. Establish session first.`);
            }
        } catch (error) {
            if (error instanceof EncryptionError) throw error;
            console.error('[KeyManager] Error checking session existence:', error);
            throw new EncryptionError('Failed to verify session existence', error);
        }
        
        let sessionCipher;
        try {
            sessionCipher = new libsignal.SessionCipher(store, address);
        } catch (error) {
            console.error('[KeyManager] Error creating session cipher:', error);
            throw new EncryptionError(`Failed to create session cipher for ${address.toString()}`, error);
        }

        let ciphertext;
        try {
            const messageBuffer = new TextEncoder().encode(plainTextMessage).buffer;
            ciphertext = await sessionCipher.encrypt(messageBuffer);
            const bodyB64 = arrayBufferToBase64(ciphertext.body);
            return {
              type: ciphertext.type,
              encryptedContent: bodyB64,  
              registrationId: ciphertext.registrationId,
            };
        } catch (error) {
            console.error(`[KeyManager] Error encrypting message for ${address.toString()}:`, error);
            
            if (error.message && error.message.includes('No session record')) {
                throw new EncryptionError('Session record corrupted or missing', error);
            } else {
                throw new EncryptionError(`Failed to encrypt message for ${address.toString()}`, error);
            }
        }

        console.log(`[KeyManager] Message encrypted successfully for ${address.toString()}`);
        
        return {
            type: ciphertext.type,
            encryptedContent: ciphertext.body, 
            registrationId: ciphertext.registrationId,
        };
        
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
        validateRecipientId(senderId);
        validateEncryptedMessage(remoteSignalMessage);

        const deviceId = 1;
        const address = new libsignal.SignalProtocolAddress(senderId.toString(), deviceId);
        
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
                encryptedContent = base64ToArrayBuffer(remoteSignalMessage.encryptedContent);
            } catch (error) {
                console.error('[KeyManager] Error converting encrypted content from base64:', error);
                throw new DecryptionError('Failed to decode encrypted message content', error);
            }

            if (remoteSignalMessage.type === libsignal.CiphertextMessage.PREKEY_TYPE) {
                plaintextBuffer = await sessionCipher.decryptPreKeyWhisperMessage(
                    encryptedContent, 
                    'binary' 
                );
            } else if (remoteSignalMessage.type === libsignal.CiphertextMessage.WHISPER_TYPE) { 
                plaintextBuffer = await sessionCipher.decryptWhisperMessage(
                    encryptedContent,
                    'binary'
                );
            } else {
                throw new DecryptionError(`Unknown message type: ${remoteSignalMessage.type}`);
            }
        } catch (error) {
            console.error(`[KeyManager] Error decrypting message from ${address.toString()}:`, error);
            
            if (error instanceof DecryptionError) {
                throw error;
            } else if (error.message && error.message.includes('No session record')) {
                throw new DecryptionError('No session exists for sender - cannot decrypt', error);
            } else if (error.message && error.message.includes('Duplicate message')) {
                throw new DecryptionError('Duplicate message detected - possible replay attack', error);
            } else if (error.message && error.message.includes('Invalid MAC')) {
                throw new DecryptionError('Message authentication failed - possible tampering', error);
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