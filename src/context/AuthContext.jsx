import { useCallback, useEffect} from "react";
import { createContext, useState, useContext } from "react";
import { baseURL, postRequest } from "../utils/services";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {

    const [user, setUser] = useState(null);
    const [loadingUser, setLoadingUser] = useState(true);
  

    const [isLoginLoading, setIsLoginLoading] = useState(false);
    const [loginError, setLoginError] = useState(null);
  

    const [registerInfo, setRegisterInfo] = useState({ name: '', email: '', password: '' });
    const [isRegisterLoading, setIsRegisterLoading] = useState(false);
    const [registerError, setRegisterError] = useState(null);

    useEffect(() => {
        (async () => {
          const stored = localStorage.getItem('user');
          if (stored) {
            const storedUser = JSON.parse(stored);
            try {
              const res = await fetch(`${baseURL}users/find/${storedUser.id}`);
              const data = await res.json();
              if (res.ok) setUser(data.user);
            } catch (err) {
              console.error('Failed to fetch stored user', err);
            }
          }
          setLoadingUser(false);
        })();
      }, []);

      const login = useCallback(
        async ({ email, password }) => {
          setIsLoginLoading(true);
          setLoginError(null);
          try {
            const res = await postRequest('users/login', { email, password });
            setUser(res.user);
            localStorage.setItem('user', JSON.stringify(res.user));
            return res;
          } catch (err) {
            setLoginError(err.message);
            throw err;
          } finally {
            setIsLoginLoading(false);
          }
        },
        []
      );
    
    const register = useCallback(async (info = registerInfo) => {
        setIsRegisterLoading(true);
        setRegisterError(null);
        try{
            const res = await postRequest('users/register', info);
            setUser(res.user);
            localStorage.setItem('user', JSON.stringify(res.user));
            setIsRegisterLoading(false);
            return res;
        }catch (error) {
            setRegisterError(error.message);
            throw error;
        }
        finally {
            setIsRegisterLoading(false);
        }
    }, [registerInfo]);
    
    const logout = useCallback(() => {
        localStorage.removeItem('user');
        setUser(null);
      }, []);
    
    
      return (
        <AuthContext.Provider
          value={{
            user,
            loadingUser,
            isLoginLoading,
            loginError,
            login,
            registerInfo,
            setRegisterInfo,
            isRegisterLoading,
            registerError,
            register,
            logout,
          }}
        >
          {children}
        </AuthContext.Provider>
      );
    };

export const useAuth = () => {
        const ctx = useContext(AuthContext);
        if (!ctx) {
          throw new Error('useAuth must be used within an AuthProvider');
        }
        return ctx;
      }
    
    
    
    