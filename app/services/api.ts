import axios, { AxiosInstance } from 'axios';
import * as SecureStore from 'expo-secure-store';
import {
  AdaptResponse,
  DailyChallengeResponse,
  GameSessionPayload,
  LoginResponse,
  ProgressData,
  RegisterPayload,
  StudentProfile,
} from '../types';

const BASE_URL = 'http://10.109.163.1:8000';
const ACCESS_TOKEN_KEY = 'mm_access_token';
const REFRESH_TOKEN_KEY = 'mm_refresh_token';

export const tokenStorage = {
  saveTokens: async (accessToken: string, refreshToken: string): Promise<void> => {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  },
  clearTokens: async (): Promise<void> => {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },
  getAccessToken: (): Promise<string | null> => SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
  getRefreshToken: (): Promise<string | null> => SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
};

const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

apiClient.interceptors.request.use(async (config) => {
  const token = await tokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await tokenStorage.getRefreshToken();

        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const refreshResponse = await axios.post<{
          access_token: string;
          token_type: string;
        }>(`${BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, refreshResponse.data.access_token);
        originalRequest.headers.Authorization = `Bearer ${refreshResponse.data.access_token}`;

        return apiClient(originalRequest);
      } catch {
        await tokenStorage.clearTokens();
      }
    }

    return Promise.reject(error);
  }
);

export const extractApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') {
      return detail;
    }

    if (error.code === 'ECONNABORTED') {
      return 'Request timed out. Check that the FastAPI server is running and reachable from this device.';
    }

    if (!error.response) {
      return 'Cannot reach the backend. Start FastAPI with --host 0.0.0.0 and use your computer LAN IP in BASE_URL.';
    }
  }

  return 'Something went wrong. Please try again.';
};

export const authApi = {
  login: (username: string, password: string) =>
    apiClient.post<LoginResponse>('/auth/login', { username, password }),

  register: (payload: RegisterPayload) =>
    apiClient.post<StudentProfile>('/auth/register', payload),

  refresh: (refreshToken: string) =>
    apiClient.post<{ access_token: string; token_type: string }>('/auth/refresh', {
      refresh_token: refreshToken,
    }),
};

export const studentApi = {
  getMe: () => apiClient.get<StudentProfile>('/students/me'),

  updateMe: (payload: Partial<Pick<StudentProfile, 'full_name' | 'age' | 'avatar'>>) =>
    apiClient.put<StudentProfile>('/students/me', payload),
};

export const sessionsApi = {
  save: (payload: GameSessionPayload) =>
    apiClient.post<{ saved: boolean; sessionId: string }>('/sessions', payload),
};

export const adaptApi = {
  next: (payload: GameSessionPayload) => apiClient.post<AdaptResponse>('/adapt', payload),
};

export const progressApi = {
  getMe: () => apiClient.get<ProgressData>('/progress/me'),
  getById: (studentId: string) => apiClient.get<ProgressData>(`/progress/${studentId}`),
};

export const dailyChallengeApi = {
  get: () => apiClient.get<DailyChallengeResponse>('/daily-challenge'),
};

export default apiClient;