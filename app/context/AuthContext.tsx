import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  JSX,
} from 'react';
import { authApi, studentApi, tokenStorage } from '../services/api';
import { RegisterPayload, StudentProfile } from '../types';

interface AuthContextType {
  student: StudentProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps): JSX.Element => {
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const hydrateAuth = async (): Promise<void> => {
      try {
        const token = await tokenStorage.getAccessToken();

        if (token) {
          const response = await studentApi.getMe();
          setStudent(response.data);
          setIsAuthenticated(true);
        }
      } catch {
        await tokenStorage.clearTokens();
      } finally {
        setIsLoading(false);
      }
    };

    hydrateAuth();
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<void> => {
    const response = await authApi.login(username, password);
    await tokenStorage.saveTokens(response.data.access_token, response.data.refresh_token);
    setStudent(response.data.student);
    setIsAuthenticated(true);
  }, []);

  const register = useCallback(async (payload: RegisterPayload): Promise<void> => {
    await authApi.register(payload);
    const response = await authApi.login(payload.username, payload.password);
    await tokenStorage.saveTokens(response.data.access_token, response.data.refresh_token);
    setStudent(response.data.student);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await tokenStorage.clearTokens();
    setStudent(null);
    setIsAuthenticated(false);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      student,
      isAuthenticated,
      isLoading,
      login,
      register,
      logout,
    }),
    [student, isAuthenticated, isLoading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
};