//src/E2EE/cryptoUtils.js
export function arrayBufferToBase64(buffer) {
    if (!buffer) {
        console.error('[cryptoUtils] Null or undefined buffer provided to arrayBufferToBase64');
        return '';
    }
    
    try {
        const view = buffer instanceof ArrayBuffer 
            ? new Uint8Array(buffer) 
            : buffer instanceof Uint8Array
                ? buffer
                : new Uint8Array(buffer.buffer || buffer);

        console.log('[cryptoUtils] Converting buffer to base64, length:', view.byteLength);

        const chunkSize = 0xffff; 
        let binary = '';
        
        for (let i = 0; i < view.byteLength; i += chunkSize) {
            const chunk = view.subarray(i, Math.min(i + chunkSize, view.byteLength));
            binary += String.fromCharCode.apply(null, chunk);
        }
        
        const result = window.btoa(binary);
        console.log('[cryptoUtils] Base64 result length:', result.length);
        return result;
    } catch (error) {
        console.error('[cryptoUtils] Error in arrayBufferToBase64:', error);
        throw new Error('Failed to convert ArrayBuffer to Base64: ' + error.message);
    }
}


export function base64ToArrayBuffer(base64) {
    if (!base64 || base64.length === 0) {
        console.error('[cryptoUtils] Empty or missing base64 string provided');
        throw new Error('Base64 string cannot be empty');
    }
    
    try {
        let sanitizedBase64 = base64.trim().replace(/[^A-Za-z0-9+/=]/g, '');
        
        const paddingNeeded = sanitizedBase64.length % 4;
        if (paddingNeeded) {
            sanitizedBase64 += '='.repeat(4 - paddingNeeded);
        }
        
        if (!/^[A-Za-z0-9+/=]+$/.test(sanitizedBase64)) {
            throw new Error('Invalid base64 string format');
        }
        
        console.log(`[cryptoUtils] Processing base64 string of length ${sanitizedBase64.length}`);
        
        const binary_string = window.atob(sanitizedBase64);
        const len = binary_string.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes.buffer;
    } catch (error) {
        console.error('[cryptoUtils] Error in base64ToArrayBuffer:', error);
        throw new Error('Failed to convert Base64 to ArrayBuffer: ' + error.message);
    }
}