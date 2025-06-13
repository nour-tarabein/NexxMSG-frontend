// src/context/authContext.js
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

    const handleKeyInitialization = useCallback(async () => {
        try {
            console.log("[AuthContext] STEP 1: Calling handleKeyInitialization...");
            setKeyError(null);
            
            const keyResult = await keyManager.initializeUserKeysIfNeeded();
            
            console.log("[AuthContext] STEP 2: Received key result from keyManager.", keyResult);

            if (keyResult.isNew && keyResult.keysForServer) {
                console.log("%c[AuthContext] STEP 3: New keys detected. Preparing to UPLOAD to server.", "color: blue; font-weight: bold;");
                console.log("[AuthContext] Payload to be sent:", keyResult.keysForServer);
                
                const token = localStorage.getItem('token');
                if (!token) {
                    throw new Error("No auth token found in localStorage, cant do key registration.");
                }
                console.log(`[AuthContext] Auth token found. Making API call...`);

                const response = await postRequest('keys/register', keyResult.keysForServer);
                
                console.log("STEP 4: RESPONSE from '/keys/register' API:",  response);

                if (response.error) {
                    throw new Error(`Server returned an error during key registration: ${response.message}`);
                }
                
                console.log("[AuthContext] KEY REGISTRATION SUCCEEDED.");
            } else {
                console.log("[AuthContext] Keys already exist in local storage, no need to upload");
            }
        } catch (error) {
            console.error("[AuthContext] CRITICAL ERROR during key initialization/upload:", error);
            setKeyError(error.message);
        }
    }, []);

    useEffect(() => {
        (async () => {
          const storedUser = localStorage.getItem('user');
          const token = localStorage.getItem('token');
          if (storedUser && token) {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            await handleKeyInitialization();
          }
          setLoadingUser(false);
        })();
      }, [handleKeyInitialization]);

    const login = useCallback(
        async ({ email, password }) => {
          setIsLoginLoading(true);
          setLoginError(null);
          try {
            const res = await postRequest('users/login', { email, password });
            console.log("[AuthContext] Login response received:", res);
            if (res.error) throw new Error(res.message);
            
            localStorage.setItem('user', JSON.stringify(res.user));
            if (res.token) localStorage.setItem('token', res.token);
            setUser(res.user);
            await handleKeyInitialization();
            return res;
          } catch (err) {
            console.error("[AuthContext] Login failed:", err);
            setLoginError(err.message);
            throw err;
          } finally {
            setIsLoginLoading(false);
          }
        },
        [handleKeyInitialization]
    );
    
    const register = useCallback(async (info = registerInfo) => {
        setIsRegisterLoading(true);
        setRegisterError(null);
        try{
            const res = await postRequest('users/register', info);
            if (res.error) throw new Error(res.message);
            
            localStorage.setItem('user', JSON.stringify(res.user));
            if (res.token) localStorage.setItem('token', res.token);
            setUser(res.user);
            await handleKeyInitialization();
            setIsRegisterLoading(false);
            return res;
        } catch (error) {
            setRegisterError(error.message);
            throw error;
        } finally {
            setIsRegisterLoading(false);
        }
    }, [registerInfo, handleKeyInitialization]);
    
    const logout = useCallback(() => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setUser(null);
        setKeyError(null);
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
