/**
 * Annual Goal Service - Manages yearly sales goals via /api/annual-goal endpoint
 * 
 * This service handles CRUD operations for commercial goals (Metas Comerciais)
 * replacing the previous approach that used calculator/config endpoint.
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://apiv2.opendata.center/api';
const AUTH_TOKEN_KEY = 'open_access_token';
const LEGACY_AUTH_TOKEN_KEY = 'open_api_token';

// Types matching the API structure
export interface AnnualGoalExecutive {
  id: number;
  name?: string;
  email?: string;
  team_type: 'interno' | 'externo';
  annual_target: number;
  monthly_mrr_target: number;
  monthly_targets: {
    jan: number;
    feb: number;
    mar: number;
    apr: number;
    may: number;
    jun: number;
    jul: number;
    aug: number;
    sep: number;
    oct: number;
    nov: number;
    dec: number;
  };
  quarter_targets: {
    Q1: number;
    Q2: number;
    Q3: number;
    Q4: number;
  };
}

export interface AnnualGoalGlobal {
  annual_target: number;
  global_mrr_target: number;
  quarter_weights: {
    Q1: number;
    Q2: number;
    Q3: number;
    Q4: number;
  };
  monthly_targets: {
    jan: number;
    feb: number;
    mar: number;
    apr: number;
    may: number;
    jun: number;
    jul: number;
    aug: number;
    sep: number;
    oct: number;
    nov: number;
    dec: number;
  };
}

export interface AnnualGoal {
  id: number;
  year: number;
  global: AnnualGoalGlobal;
  executives: AnnualGoalExecutive[];
  created_at: string;
  updated_at: string;
}

export interface AnnualGoalStoreRequest {
  year: number;
  global: AnnualGoalGlobal;
  executives: AnnualGoalExecutive[];
}

export interface AnnualGoalUpdateRequest {
  year?: number;
  global?: AnnualGoalGlobal;
  executives?: AnnualGoalExecutive[];
}

interface PaginatedResponse<T> {
  current_page: number;
  data: T[];
  from: number;
  last_page: number;
  per_page: number;
  to: number;
  total: number;
}

function getToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
}

function getHeaders() {
  const token = getToken();
  return {
    Authorization: token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json',
  };
}

/**
 * Fetch all annual goals (paginated)
 */
export async function fetchAnnualGoals(params?: {
  __page?: number;
  __perPage?: number;
  year?: number;
}): Promise<PaginatedResponse<AnnualGoal>> {
  const response = await axios.get<PaginatedResponse<AnnualGoal>>(`${API_BASE_URL}/annual-goal`, {
    params: {
      __perPage: 100,
      ...params,
    },
    headers: getHeaders(),
  });
  return response.data;
}

/**
 * Fetch a specific annual goal by ID
 */
export async function fetchAnnualGoalById(id: number): Promise<AnnualGoal> {
  const response = await axios.get<AnnualGoal>(`${API_BASE_URL}/annual-goal/${id}`, {
    headers: getHeaders(),
  });
  return response.data;
}

/**
 * Fetch annual goal by year
 */
export async function fetchAnnualGoalByYear(year: number): Promise<AnnualGoal | null> {
  const response = await fetchAnnualGoals({ year, __perPage: 1 });
  return response.data.length > 0 ? response.data[0] : null;
}

/**
 * Create a new annual goal
 */
export async function createAnnualGoal(data: AnnualGoalStoreRequest): Promise<AnnualGoal> {
  const response = await axios.post<AnnualGoal>(`${API_BASE_URL}/annual-goal`, data, {
    headers: getHeaders(),
  });
  return response.data;
}

/**
 * Update an existing annual goal
 */
export async function updateAnnualGoal(id: number, data: AnnualGoalUpdateRequest): Promise<AnnualGoal> {
  const response = await axios.put<AnnualGoal>(`${API_BASE_URL}/annual-goal/${id}`, data, {
    headers: getHeaders(),
  });
  return response.data;
}

/**
 * Delete an annual goal
 */
export async function deleteAnnualGoal(id: number): Promise<void> {
  await axios.delete(`${API_BASE_URL}/annual-goal/${id}`, {
    headers: getHeaders(),
  });
}

// Export the service as an object for easier use
export const annualGoalService = {
  fetchAll: fetchAnnualGoals,
  fetchById: fetchAnnualGoalById,
  fetchByYear: fetchAnnualGoalByYear,
  create: createAnnualGoal,
  update: updateAnnualGoal,
  delete: deleteAnnualGoal,
};
