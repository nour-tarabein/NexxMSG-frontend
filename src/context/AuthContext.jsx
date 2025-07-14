import { useCallback, useEffect, useState, createContext, useContext } from "react";
import { postRequest } from "../utils/services";
import * as keyManager from '../E2EE/keyManager';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const [isLoginLoading, setIsLoginLoading] = useState(false);
    const [loginError, setLoginError] = useState(null);
    const [registerInfo, setRegisterInfo] = useState({ name: '', email: '', password: '' });
    const [isRegisterLoading, setIsRegisterLoading] = useState(false);
    const [registerError, setRegisterError] = useState(null);
    const [keyError, setKeyError] = useState(null);

    const initializeAndRegisterKeys = useCallback(async (authToken) => {
        if (!authToken) {
            console.error("[Auth] Cannot register keys without an auth token.");
            setKeyError("Authentication token is missing.");
            return;
        }

        try {
            setKeyError(null);
            const keyResult = await keyManager.initializeUserKeysIfNeeded();

            if (keyResult.isNew && keyResult.keysForServer) {
                console.log("%c[Auth] New keys detected. Registering with server...", "color: blue; font-weight: bold;");

                const response = await postRequest('keys/register', keyResult.keysForServer, authToken);

                if (response.error) {
                    throw new Error(`Server error during key registration: ${response.message}`);
                }
                
                console.log("[Auth] Key registration succeeded.");
            } else {
                console.log("[Auth] Existing keys found, no registration needed.");
            }
        } catch (error) {
            console.error("[Auth] CRITICAL ERROR during key initialization/upload:", error);
            setKeyError(error.message);
        }
    }, []);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setLoadingUser(false);
    }, []);

    useEffect(() => {
        if (user) {
            const token = localStorage.getItem('token');
            initializeAndRegisterKeys(token);
        }
    }, [user, initializeAndRegisterKeys]);

    const login = useCallback(async ({ email, password }) => {
        setIsLoginLoading(true);
        setLoginError(null);
        try {
            const res = await postRequest('users/login', { email, password });
            if (res.error) throw new Error(res.message);
            
            localStorage.setItem('user', JSON.stringify(res.user));
            if (res.token) localStorage.setItem('token', res.token);
            
            setUser(res.user); 
            return res;
        } catch (err) {
            setLoginError(err.message);
            throw err;
        } finally {
            setIsLoginLoading(false);
        }
    }, []);
    
    const register = useCallback(async (info = registerInfo) => {
        setIsRegisterLoading(true);
        setRegisterError(null);
        try {
            const res = await postRequest('users/register', info);
            if (res.error) throw new Error(res.message);
            
            localStorage.setItem('user', JSON.stringify(res.user));
            if (res.token) localStorage.setItem('token', res.token);

            setUser(res.user);
            return res;
        } catch (error) {
            setRegisterError(error.message);
            throw error;
        } finally {
            setIsRegisterLoading(false);
        }
    }, [registerInfo]);
    
    const logout = useCallback(() => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setUser(null);
        setKeyError(null);
        keyManager.clearAllKeys(); 
    }, []);
    
    return (
        <AuthContext.Provider
            value={{ user, loadingUser, isLoginLoading, loginError, login, registerInfo, setRegisterInfo, isRegisterLoading, registerError, register, logout, keyError }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
    return ctx;
};