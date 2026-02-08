import { Http } from "@/lib/Http";
import axios from "axios";
import * as types from './types'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Add auth interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('open_access_token') || localStorage.getItem('open_api_token');
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});


export async function get<T>(endpoint: string, queryString?: Record<string, any>): Promise<types.RequestError | types.RequestResponse<T>> {
  const query = Http.toQueryString(queryString)
  const url = query ? `${endpoint}?${query}` : endpoint
  return makeRequest<T>(api.get(url))
}

export async function post<T>(endpoint: string, payload: any): Promise<types.RequestError | types.RequestResponse<T>> {
  return makeRequest<T>(api.post(endpoint, payload))
}

export async function put<T>(endpoint: string, payload: any): Promise<types.RequestError | types.RequestResponse<T>> {
  return makeRequest<T>(api.put(endpoint, payload))
}

export async function del<T>(endpoint: string, queryString?: Record<string, any>): Promise<types.RequestError | types.RequestResponse<T>> {
  const query = Http.toQueryString(queryString)
  const url = query ? `${endpoint}?${query}` : endpoint
  return makeRequest<T>(api.delete(url))
}


async function makeRequest<T>(caller: Promise<any>): Promise<types.RequestError | types.RequestResponse<T>> {
  try {
    const { data } = await caller
    return { data: data as T, isError: false }
  } catch (err: any) {
    console.error('ERRO NA REQUISIÇÃO PARA A API:', err)

    return {
      data: err?.response?.data,
      message: err?.response?.data?.message || err?.response?.message || err?.message || 'Falha ao processar requisição',
      isError: true
    }
  }
}
