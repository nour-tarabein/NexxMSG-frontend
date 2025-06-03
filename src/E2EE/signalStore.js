// src/E2EE/signalStore.js
import * as libsignal from 'libsignal-protocol-javascript'; 
import { openDB } from 'idb';

const DB_NAME = 'NexxMSG_Signal_Store_IDB';
const DB_VERSION = 1;
const KEY_VALUE_STORE_NAME = 'key_value_store'; 
const STORE_NAME_PREFIX = 'signal_'; 


const dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
        if (!db.objectStoreNames.contains(KEY_VALUE_STORE_NAME)) {
            db.createObjectStore(KEY_VALUE_STORE_NAME, { keyPath: 'id' });
        }
    },
});

async function dbGet(key) {
    return (await dbPromise).get(KEY_VALUE_STORE_NAME, STORE_NAME_PREFIX + key)
        .then(result => result ? result.value : undefined);
}

async function dbPut(key, value) {
    return (await dbPromise).put(KEY_VALUE_STORE_NAME, { id: STORE_NAME_PREFIX + key, value: value });
}

async function dbRemove(key) {
    return (await dbPromise).delete(KEY_VALUE_STORE_NAME, STORE_NAME_PREFIX + key);
}

async function dbGetAllKeysStartingWith(prefix) {
    const db = await dbPromise;
    const tx = db.transaction(KEY_VALUE_STORE_NAME, 'readonly');
    const store = tx.objectStore(KEY_VALUE_STORE_NAME);
    const allRecords = [];
    let cursor = await store.openCursor();
    const actualPrefix = STORE_NAME_PREFIX + prefix;

    while (cursor) {
        if (typeof cursor.key === 'string' && cursor.key.startsWith(actualPrefix)) {
            allRecords.push(cursor.value.value); 
        }
        cursor = await cursor.continue();
    }
    await tx.done;
    return allRecords;
}

const SignalProtocolStore = {

    _formatAddress: function(name, deviceId = 1) { 
        return `${name}.${deviceId}`;
    },

    getIdentityKeyPair: async function() {
        return dbGet('identityKey');
    },
    getLocalRegistrationId: async function() {
        return dbGet('registrationId');
    },
    putIdentityKeyPair: async function(identityKeyPair) {
        return dbPut('identityKey', identityKeyPair);
    },
    putLocalRegistrationId: async function(registrationId) {
        return dbPut('registrationId', registrationId);
    },

    loadPreKey: async function(keyId) {
        return dbGet(`preKey-${keyId}`);
    },
    storePreKey: async function(keyId, keyPair) {
        return dbPut(`preKey-${keyId}`, keyPair);
    },
    removePreKey: async function(keyId) {
        return dbRemove(`preKey-${keyId}`);
    },
    containsPreKey: async function(keyId) {
        return !!(await this.loadPreKey(keyId));
    },
     getAllPreKeys: async function() { 
        return dbGetAllKeysStartingWith('preKey-');
    },


    loadSignedPreKey: async function(keyId) {
        const record = await dbGet(`signedPreKey-${keyId}`);
        return record === undefined ? undefined : record;
    },
    
    storeSignedPreKey: async function(keyId, keyPair, signature) {
        return dbPut(
          `signedPreKey-${keyId}`,
          { keyPair: keyPair, signature: signature }
        );
    },
    removeSignedPreKey: async function(keyId) {
        return dbRemove(`signedPreKey-${keyId}`);
    },
    containsSignedPreKey: async function(keyId) {
        return !!(await this.loadSignedPreKey(keyId));
    },

    loadSession: async function(addressString) { 
        const serializedRecord = await dbGet(`session-${addressString}`);
        if (serializedRecord) {
            return libsignal.SessionRecord.deserialize(serializedRecord);
        }
        return undefined;
    },
    storeSession: async function(addressString, record) {
        return dbPut(`session-${addressString}`, record.serialize());
    },
    removeSession: async function(addressString) {
        return dbRemove(`session-${addressString}`);
    },
    removeAllSessions: async function(name) {
        const db = await dbPromise;
        const tx = db.transaction(KEY_VALUE_STORE_NAME, 'readwrite');
        const store = tx.objectStore(KEY_VALUE_STORE_NAME);
        const prefixToDelete = STORE_NAME_PREFIX + `session-${name}.`;
        let cursor = await store.openCursor();
        while(cursor) {
            if (typeof cursor.key === 'string' && cursor.key.startsWith(prefixToDelete)) {
                await cursor.delete();
            }
            cursor = await cursor.continue();
        }
        return tx.done;
    },
    containsSession: async function(addressString) {
        return !!(await this.loadSession(addressString));
    },

    isTrustedIdentity: async function(identifier, identityKeyBuffer, direction) {
        if (!identifier) throw new Error("isTrustedIdentity: identifier is null or undefined");
        const trustedIdentity = await dbGet(`identityKey-${identifier}`);
        if (trustedIdentity === undefined) return true;
        return libsignal.crypto.bufferCompare(identityKeyBuffer, trustedIdentity) === 0;
    },
    saveIdentity: async function(identifier, identityKeyBuffer) {
        if (!identifier) throw new Error("saveIdentity: identifier is null or undefined");
        const existingIdentity = await dbGet(`identityKey-${identifier}`);
        await dbPut(`identityKey-${identifier}`, identityKeyBuffer);
        if (existingIdentity && libsignal.crypto.bufferCompare(identityKeyBuffer, existingIdentity) !== 0) {
            console.warn(`Identity key for ${identifier} has changed.`);
            return true; 
        }
        return false; 
    },

    getOurDeviceId: function() { return 1; }
};

export default SignalProtocolStore;