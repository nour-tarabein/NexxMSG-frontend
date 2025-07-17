import { arrayBufferToBase64, base64ToArrayBuffer } from './cryptoUtils';
import { getRequest } from '../utils/services';

// Constants
const encrpytionAlgorithm = 'AES-GCM';
const asymmetric = 'RSA-OAEP';
const hash = 'SHA-256';
const AES = 256;
const RSA = 2048;
const IV_LENGTH = 12;

const MESSAGE_TYPES = {
    ENCRYPTED: 1,
    FALLBACK: 9999
};

// Error classes
export class E2EEError extends Error {
    constructor(message, code, originalError = null) {
        super(message);
        this.name = 'E2EEError';
        this.code = code;
        this.originalError = originalError;
    }
}

export class EncryptionError extends E2EEError { }
export class DecryptionError extends E2EEError { }

class KeyStore {
    constructor() {
        this.identityKeyPair = null;
        this.registrationId = null;
        this.sessionKeys = new Map();
        this.publicKeys = new Map();
        this.loadFromStorage();
    }

    async loadFromStorage() {
        try {
            const storedIdentity = localStorage.getItem('identity_keypair');
            const storedRegId = localStorage.getItem('registration_id');
            const storedSessions = localStorage.getItem('session_keys');
            const storedPublicKeys = localStorage.getItem('public_keys');

            if (storedIdentity) {
                const keyData = JSON.parse(storedIdentity);
                this.identityKeyPair = {
                    publicKey: await crypto.subtle.importKey(
                        'jwk',
                        keyData.publicKey,
                        { name: asymmetric, hash: hash },
                        true,
                        ['encrypt']
                    ),
                    privateKey: await crypto.subtle.importKey(
                        'jwk',
                        keyData.privateKey,
                        { name: asymmetric, hash: hash },
                        true,
                        ['decrypt']
                    )
                };
            }

            if (storedRegId) {
                this.registrationId = storedRegId;
            }

            if (storedSessions) {
                const sessionData = JSON.parse(storedSessions);
                for (const [recipientId, keyData] of Object.entries(sessionData)) {
                    const aesKey = await crypto.subtle.importKey(
                        'jwk',
                        keyData,
                        { name: encrpytionAlgorithm },
                        true,
                        ['encrypt', 'decrypt']
                    );
                    this.sessionKeys.set(recipientId, aesKey);
                }
            }

            if (storedPublicKeys) {
                const publicKeyData = JSON.parse(storedPublicKeys);
                for (const [recipientId, keyData] of Object.entries(publicKeyData)) {
                    const publicKey = await crypto.subtle.importKey(
                        'jwk',
                        keyData,
                        { name: asymmetric, hash: hash },
                        true,
                        ['encrypt']
                    );
                    this.publicKeys.set(recipientId, publicKey);
                }
            }
        } catch (error) {
            console.error('Error loading keys from storage:', error);
        }
    }

    async saveToStorage() {
        try {
            if (this.identityKeyPair) {
                const publicKeyJWK = await crypto.subtle.exportKey('jwk', this.identityKeyPair.publicKey);
                const privateKeyJWK = await crypto.subtle.exportKey('jwk', this.identityKeyPair.privateKey);
                localStorage.setItem('identity_keypair', JSON.stringify({
                    publicKey: publicKeyJWK,
                    privateKey: privateKeyJWK
                }));
            }

            if (this.registrationId) {
                localStorage.setItem('registration_id', this.registrationId.toString());
            }

            const sessionData = {};
            for (const [recipientId, key] of this.sessionKeys.entries()) {
                const keyJWK = await crypto.subtle.exportKey('jwk', key);
                sessionData[recipientId] = keyJWK;
            }
            localStorage.setItem('session_keys', JSON.stringify(sessionData));

            const publicKeyData = {};
            for (const [recipientId, key] of this.publicKeys.entries()) {
                const keyJWK = await crypto.subtle.exportKey('jwk', key);
                publicKeyData[recipientId] = keyJWK;
            }
            localStorage.setItem('public_keys', JSON.stringify(publicKeyData));
        } catch (error) {
            console.error('Error saving keys to storage:', error);
        }
    }

    async getIdentityKeyPair() {
        return this.identityKeyPair;
    }

    async setIdentityKeyPair(keyPair) {
        this.identityKeyPair = keyPair;
        await this.saveToStorage();
    }

    async getRegistrationId() {
        return this.registrationId;
    }

    async setRegistrationId(id) {
        this.registrationId = id;
        await this.saveToStorage();
    }

    async getSessionKey(recipientId) {
        return this.sessionKeys.get(String(recipientId));
    }

    async setSessionKey(recipientId, key) {
        this.sessionKeys.set(String(recipientId), key);
        await this.saveToStorage();
    }

    async hasSession(recipientId) {
        return this.sessionKeys.has(String(recipientId));
    }

    async removeSession(recipientId) {
        this.sessionKeys.delete(String(recipientId));
        this.publicKeys.delete(String(recipientId));
        await this.saveToStorage();
    }

    async setPublicKey(recipientId, publicKey) {
        this.publicKeys.set(String(recipientId), publicKey);
        await this.saveToStorage();
    }

    async getPublicKey(recipientId) {
        return this.publicKeys.get(String(recipientId));
    }

    async clearAll() {
        this.identityKeyPair = null;
        this.registrationId = null;
        this.sessionKeys.clear();
        this.publicKeys.clear();
        localStorage.removeItem('identity_keypair');
        localStorage.removeItem('registration_id');
        localStorage.removeItem('session_keys');
        localStorage.removeItem('public_keys');
    }
}
const keyStore = new KeyStore();

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

async function generateAESKey() {
    return await crypto.subtle.generateKey(
        {
            name: encrpytionAlgorithm,
            length: AES,
        },
        true,
        ['encrypt', 'decrypt']
    );
}

async function generateRSAKeyPair() {
    return await crypto.subtle.generateKey(
        {
            name: asymmetric,
            modulusLength: RSA,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: hash,
        },
        true,
        ['encrypt', 'decrypt']
    );
}

async function generateIV() {
    return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}


export async function initializeUserKeysIfNeeded() {
    try {
        const identityKeyPair = await keyStore.getIdentityKeyPair();
        const registrationId = await keyStore.getRegistrationId();

        if (identityKeyPair && registrationId) {
            const publicKeyJWK = await crypto.subtle.exportKey('jwk', identityKeyPair.publicKey);
            return {
                isNew: false,
                identityPublicKey: JSON.stringify(publicKeyJWK),
                registrationId
            };
        }

        const newKeyPair = await generateRSAKeyPair();
        const randomBytes = new Uint8Array(16);
        crypto.getRandomValues(randomBytes);
        const newRegistrationId = Array.from(randomBytes)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');

        await keyStore.setIdentityKeyPair(newKeyPair);
        await keyStore.setRegistrationId(newRegistrationId);

        const publicKeyJWK = await crypto.subtle.exportKey('jwk', newKeyPair.publicKey);
        
        return {
            isNew: true,
            keysForServer: {
                identityPublicKey: JSON.stringify(publicKeyJWK),
                registrationId: newRegistrationId
            }
        };
    } catch (error) {
        throw new E2EEError('Failed to initialize user keys', null, error);
    }
}

export async function processPreKeyBundle(recipientId, preKeyBundle) {
    try {
        const recipientIdStr = validateRecipientId(recipientId);
        
        if (!preKeyBundle.identityKey) {
            throw new E2EEError('Missing identity key in bundle');
        }

        const publicKeyData = JSON.parse(preKeyBundle.identityKey);
        const publicKey = await crypto.subtle.importKey(
            'jwk',
            publicKeyData,
            { name: asymmetric, hash: hash },
            true,
            ['encrypt']
        );

        await keyStore.setPublicKey(recipientIdStr, publicKey);

        const sessionKey = await generateAESKey();
        await keyStore.setSessionKey(recipientIdStr, sessionKey);

        return true;
    } catch (error) {
        throw new E2EEError('Failed to process public key bundle', null, error);
    }
}

export async function hasSession(recipientId) {
    try {
        const recipientIdStr = validateRecipientId(recipientId);
        return await keyStore.hasSession(recipientIdStr);
    } catch (error) {
        return false;
    }
}

export async function removeSession(recipientId) {
    try {
        const recipientIdStr = validateRecipientId(recipientId);
        await keyStore.removeSession(recipientIdStr);
        return true;
    } catch (error) {
        return false;
    }
}

export async function encryptMessage(recipientId, plainTextMessage) {
    try {
        const recipientIdStr = validateRecipientId(recipientId);
        validateMessage(plainTextMessage);

        let sessionKey = await keyStore.getSessionKey(recipientIdStr);
        
        if (!sessionKey) {
            sessionKey = await generateAESKey();
            await keyStore.setSessionKey(recipientIdStr, sessionKey);
        }

        const iv = await generateIV();
        const messageBuffer = new TextEncoder().encode(plainTextMessage);
        
        const encryptedMessageBuffer = await crypto.subtle.encrypt(
            {
                name: encrpytionAlgorithm,
                iv: iv,
            },
            sessionKey,
            messageBuffer
        );

        const recipientPublicKey = await keyStore.getPublicKey(recipientIdStr);
        
        if (!recipientPublicKey) {
            throw new EncryptionError(`No public key found for ${recipientIdStr}`);
        }

        const sessionKeyJWK = await crypto.subtle.exportKey('jwk', sessionKey);
        const sessionKeyBuffer = new TextEncoder().encode(JSON.stringify(sessionKeyJWK));
        
        const encryptedSessionKeyBuffer = await crypto.subtle.encrypt(
            {
                name: asymmetric,
            },
            recipientPublicKey,
            sessionKeyBuffer
        );

        const combinedData = {
            iv: arrayBufferToBase64(iv.buffer),
            sessionKey: arrayBufferToBase64(encryptedSessionKeyBuffer),
            message: arrayBufferToBase64(encryptedMessageBuffer)
        };

        const encryptedContent = arrayBufferToBase64(
            new TextEncoder().encode(JSON.stringify(combinedData)).buffer
        );

        return {
            type: MESSAGE_TYPES.ENCRYPTED,
            encryptedContent,
            registrationId: await keyStore.getRegistrationId() || 0,
            messageIndex: Date.now(),
        };
    } catch (error) {
        throw new EncryptionError('Failed to encrypt message', null, error);
    }
}

export async function decryptMessage(senderId, remoteSignalMessage) {
    try {
        const senderIdStr = validateRecipientId(senderId);

        if (!remoteSignalMessage || !remoteSignalMessage.encryptedContent) {
            throw new DecryptionError('Invalid encrypted message');
        }

        if (remoteSignalMessage.type === MESSAGE_TYPES.FALLBACK) {
            const encryptedContent = base64ToArrayBuffer(remoteSignalMessage.encryptedContent);
            return new TextDecoder().decode(new Uint8Array(encryptedContent));
        }


        const encryptedData = JSON.parse(
            new TextDecoder().decode(base64ToArrayBuffer(remoteSignalMessage.encryptedContent))
        );


        const identityKeyPair = await keyStore.getIdentityKeyPair();
        if (!identityKeyPair) {
            throw new DecryptionError('No identity key pair found');
        }

        const encryptedSessionKey = base64ToArrayBuffer(encryptedData.sessionKey);
        const sessionKeyBuffer = await crypto.subtle.decrypt(
            {
                name: asymmetric,
            },
            identityKeyPair.privateKey,
            encryptedSessionKey
        );

        const sessionKeyJWK = JSON.parse(new TextDecoder().decode(sessionKeyBuffer));
        const sessionKey = await crypto.subtle.importKey(
            'jwk',
            sessionKeyJWK,
            { name: encrpytionAlgorithm },
            true,
            ['encrypt', 'decrypt']
        );

        await keyStore.setSessionKey(senderIdStr, sessionKey);

        const iv = base64ToArrayBuffer(encryptedData.iv);
        const encryptedMessage = base64ToArrayBuffer(encryptedData.message);

        const decryptedMessage = await crypto.subtle.decrypt(
            {
                name: encrpytionAlgorithm,
                iv: iv,
            },
            sessionKey,
            encryptedMessage
        );

        return new TextDecoder().decode(decryptedMessage);
    } catch (error) {
        throw new DecryptionError('Failed to decrypt message', null, error);
    }
}

export async function decryptWithStoredSessionKey(partnerId, encryptedData) {
    try {
        const partnerIdStr = validateRecipientId(partnerId);
        
        const sessionKey = await keyStore.getSessionKey(partnerIdStr);
        if (!sessionKey) {
            throw new DecryptionError(`No session key found for partner ${partnerIdStr}`);
        }

        const decodedData = JSON.parse(
            new TextDecoder().decode(base64ToArrayBuffer(encryptedData.encryptedContent))
        );
        const iv = base64ToArrayBuffer(decodedData.iv);
        const encryptedMessage = base64ToArrayBuffer(decodedData.message);

        const decryptedBuffer = await crypto.subtle.decrypt(
            { name: encrpytionAlgorithm, iv: iv },
            sessionKey,
            encryptedMessage
        );

        return new TextDecoder().decode(decryptedBuffer);
    } catch (error) {
        throw new DecryptionError('Failed to decrypt with stored session key', null, error);
    }
}

export async function ensureSessionFromPreKeyMessage(message) {
    try {
        if (!message || !message.senderId) {
            return false;
        }

        const senderIdStr = String(message.senderId);
        
        if (await keyStore.hasSession(senderIdStr)) {
            return true;
        }

        const bundleResp = await getRequest(`keys/bundle/${senderIdStr}`);
        if (bundleResp.error) {
            throw new Error(`Failed to fetch public key: ${bundleResp.message || 'Unknown error'}`);
        }

        await processPreKeyBundle(senderIdStr, bundleResp);
        return await keyStore.hasSession(senderIdStr);
    } catch (error) {
        return false;
    }
}

export async function getKeyStats() {
    try {
        const identityKeyPair = await keyStore.getIdentityKeyPair();
        const registrationId = await keyStore.getRegistrationId();
        
        return {
            hasIdentityKey: !!identityKeyPair,
            hasRegistrationId: !!registrationId,
            sessionCount: keyStore.sessionKeys.size
        };
    } catch (error) {
        return null;
    }
}

export async function clearAllKeys() {
    try {
        await keyStore.clearAll();
    } catch (error) {
        console.error('Error clearing keys:', error);
    }
}
