// src/E2EE/signalStore.js
import * as libsignal from '@privacyresearch/libsignal-protocol-typescript';

const PREFIX = {
  IDENTITY:    'identityKeyPair',
  REGISTRATION:'registrationId',
  PREKEY:      'preKey:',
  SIGNED:      'signedPreKey:',
  SESSION:     'sessionRecord:',
};

function getRaw(key) { return localStorage.getItem(key); }
function putRaw(key, v) { localStorage.setItem(key, v); }
function delRaw(key)    { localStorage.removeItem(key); }

function serializeKeyPair(pair) {
  return {
    pubKey: btoa(String.fromCharCode(...new Uint8Array(pair.pubKey))),
    privKey: btoa(String.fromCharCode(...new Uint8Array(pair.privKey)))
  };
}

function deserializeKeyPair(pair) {
  return {
    pubKey: Uint8Array.from(atob(pair.pubKey), c => c.charCodeAt(0)).buffer,
    privKey: Uint8Array.from(atob(pair.privKey), c => c.charCodeAt(0)).buffer
  };
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  return btoa(String.fromCharCode(...bytes));
}

function base64ToArrayBuffer(base64) {
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer;
}

function isSessionRecord(obj) {
  return typeof obj === 'object' && 
    obj !== null && 
    obj.sessions && 
    typeof obj.sessions === 'object';
}

export default {
  getIdentityKeyPair() {
    const raw = getRaw(PREFIX.IDENTITY);
    return raw
      ? deserializeKeyPair(JSON.parse(raw))
      : undefined;
  },
  putIdentityKeyPair(pair) {
    putRaw(PREFIX.IDENTITY, JSON.stringify(serializeKeyPair(pair)));
  },

  getLocalRegistrationId() {
    const v = getRaw(PREFIX.REGISTRATION);
    return v ? parseInt(v, 10) : undefined;
  },
  putLocalRegistrationId(id) {
    putRaw(PREFIX.REGISTRATION, id.toString());
  },

  loadPreKey(id) {
    const raw = getRaw(PREFIX.PREKEY + id);
    return raw ? deserializeKeyPair(JSON.parse(raw)) : undefined;
  },
  storePreKey(id, kp) {
    putRaw(PREFIX.PREKEY + id, JSON.stringify(serializeKeyPair(kp)));
  },
  removePreKey(id) {
    delRaw(PREFIX.PREKEY + id);
  },
  getAllPreKeys() {
    return Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX.PREKEY))
      .map(k => parseInt(k.slice(PREFIX.PREKEY.length), 10));
  },


  loadSignedPreKey(id) {
    const raw = getRaw(PREFIX.SIGNED + id);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    return {
      keyPair: deserializeKeyPair(parsed.keyPair),
      signature: Uint8Array.from(atob(parsed.signature), c => c.charCodeAt(0)).buffer
    };
  },
  storeSignedPreKey(id, kp, sig) {
    putRaw(PREFIX.SIGNED + id, JSON.stringify({
      keyPair: serializeKeyPair(kp),
      signature: btoa(String.fromCharCode(...new Uint8Array(sig)))
    }));
  },
  removeSignedPreKey(id) {
    delRaw(PREFIX.SIGNED + id);
  },

  containsSession(addr) {
    const key = PREFIX.SESSION + addr;
    return getRaw(key) != null;
  },

  loadSession(addr) {
    const key = PREFIX.SESSION + addr;
    const raw = getRaw(key);
    console.log(`[SignalStore] loadSession for key "${key}", raw value found: ${!!raw}`);
    
    if (!raw) {
      if (addr.includes('.')) {
        const integerPart = addr.split('.')[0];
        const alternateKey = PREFIX.SESSION + integerPart;
        const alternateRaw = getRaw(alternateKey);
        if (alternateRaw) {
          console.log(`[SignalStore] Found session with alternate key "${alternateKey}"`);
          putRaw(key, alternateRaw);
          return this._parseSessionData(alternateRaw);
        }
      }
      return undefined;
    }
    
    return this._parseSessionData(raw);
  },
  
  _parseSessionData(serialized) {
    try {
      console.log('[SignalStore] Session format:', typeof serialized);

      const sessionData = JSON.parse(serialized);
      console.log('[SignalStore] Parsed session as JSON');
      
      if (isSessionRecord(sessionData)) {
        console.log('[SignalStore] Found session data of type: object');
        console.log('[SignalStore] Session object contains keys:', Object.keys(sessionData));
        

        const serializedVersion = JSON.stringify(sessionData);
        return serializedVersion;
      }

      return serialized;
      
    } catch (e) {
      console.log('[SignalStore] Not JSON or error parsing:', e.message);
      return serialized;
    }
  },
  
  storeSession(addr, record) {
    try {
      const addrStr = String(addr);
      const key = PREFIX.SESSION + addrStr;
      console.log(`[SignalStore] Storing session for "${key}"`, typeof record);
      
      if (!record) {
        console.error('[SignalStore] Attempted to store null record');
        return;
      }
      
      if (record.serialize) {
        console.log('[SignalStore] Record has serialize method, using it');
        try {
          const serialized = record.serialize();
          putRaw(key, arrayBufferToBase64(serialized));
          return;
        } catch (e) {
          console.error('[SignalStore] Serialization failed:', e);
        }
      }
      
      if (typeof record === 'string') {
        console.log('[SignalStore] Storing string record directly');
        putRaw(key, record);
        return;
      }

      if (isSessionRecord(record)) {
        console.log('[SignalStore] Storing session record as JSON');
        putRaw(key, JSON.stringify(record));
        return;
      }

      if (record instanceof ArrayBuffer || record instanceof Uint8Array) {
        console.log('[SignalStore] Storing buffer as base64');
        putRaw(key, arrayBufferToBase64(record));
        return;
      }

      console.log('[SignalStore] Storing record as JSON (last resort)');
      putRaw(key, JSON.stringify(record));
      
    } catch (error) {
      console.error('[SignalStore] Error storing session:', error);
    }
  },
  
  removeSession(addr) {
    const key = PREFIX.SESSION + addr;
    console.log(`[SignalStore] Removing session for "${key}"`);

    if (addr.includes('.')) {
      const integerPart = addr.split('.')[0];
      const alternateKey = PREFIX.SESSION + integerPart;
      delRaw(alternateKey);
      console.log(`[SignalStore] Also removed alternate key "${alternateKey}"`);
    }
    
    delRaw(key);
  },

  isTrustedIdentity(id, keyBuf) {
    const raw = getRaw(`identityKey-${id}`);
    if (!raw) return true; 
    const stored = Uint8Array.from(atob(raw), c=>c.charCodeAt(0));
    return libsignal.crypto.bufferCompare(keyBuf, stored) === 0;
  },
  saveIdentity(id, keyBuf) {
    putRaw(`identityKey-${id}`, btoa(String.fromCharCode(...new Uint8Array(keyBuf))));
  },

  getOurDeviceId() { return 1; },
  

  getAllSessions() {
    const sessions = {};
    const prefix = PREFIX.SESSION;
    

    const sessionKeys = Object.keys(localStorage)
      .filter(key => key.startsWith(prefix))
      .sort();

    for (const key of sessionKeys) {
      const addr = key.slice(prefix.length);
      try {
        const raw = getRaw(key);
        let type = 'unknown';
        let hasSession = false;
        let parsedData = null;
        
        try {
          parsedData = JSON.parse(raw);
          type = 'json';
          hasSession = isSessionRecord(parsedData);
        } catch (e) {
          type = 'string/base64';
        }
        
        sessions[addr] = {
          exists: true,
          type,
          dataType: typeof raw,
          hasSession,
          length: raw ? raw.length : 0
        };
      } catch (e) {
        sessions[addr] = { exists: true, error: e.message };
      }
    }
    
    return sessions;
  }
};
