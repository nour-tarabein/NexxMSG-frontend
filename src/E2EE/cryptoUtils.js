// src/E2EE/cryptoUtils.js

export function arrayBufferToBase64(buffer) {
    if (buffer instanceof Uint8Array) {
        buffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    }
    
    if (!buffer || !(buffer instanceof ArrayBuffer)) {
        console.error('[cryptoUtils] Invalid buffer provided to arrayBufferToBase64', typeof buffer, buffer);
        return '';
    }
    
    if (buffer.byteLength === 0) {
        console.warn('[cryptoUtils] Empty buffer provided to arrayBufferToBase64');
        return '';
    }
    
    try {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        
        const base64 = btoa(binary);
        return base64;
    } catch (error) {
        console.error('[cryptoUtils] Error converting ArrayBuffer to base64:', error);
        return '';
    }
}

export function base64ToArrayBuffer(base64) {
    if (!base64 || typeof base64 !== 'string') {
        console.error('[cryptoUtils] Invalid base64 string provided');
        return new ArrayBuffer(0);
    }
    
    try {
        const cleanBase64 = base64.trim().replace(/\s/g, '');
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleanBase64)) {
            console.error('[cryptoUtils] Invalid base64 format');
            return new ArrayBuffer(0);
        }
        
        const binary = atob(cleanBase64);
        const bytes = new Uint8Array(binary.length);
        
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        
        return bytes.buffer;
    } catch (error) {
        console.error('[cryptoUtils] Error decoding base64:', error);
        return new ArrayBuffer(0);
    }
}

export function stringToArrayBuffer(str) {
    const encoder = new TextEncoder();
    return encoder.encode(str).buffer;
}

export function arrayBufferToString(buffer) {
    const decoder = new TextDecoder();
    return decoder.decode(buffer);
}

export function concatenateArrayBuffers(...buffers) {
    const validBuffers = buffers.filter(b => b instanceof ArrayBuffer && b.byteLength > 0);
    if (validBuffers.length === 0) return new ArrayBuffer(0);
    
    const totalLength = validBuffers.reduce((sum, buf) => sum + buf.byteLength, 0);
    const result = new Uint8Array(totalLength);
    
    let offset = 0;
    for (const buffer of validBuffers) {
        result.set(new Uint8Array(buffer), offset);
        offset += buffer.byteLength;
    }
    
    return result.buffer;
}

export function compareArrayBuffers(a, b) {
    if (!(a instanceof ArrayBuffer) || !(b instanceof ArrayBuffer)) return false;
    if (a.byteLength !== b.byteLength) return false;
    
    const viewA = new Uint8Array(a);
    const viewB = new Uint8Array(b);
    
    for (let i = 0; i < viewA.length; i++) {
        if (viewA[i] !== viewB[i]) return false;
    }
    
    return true;
}