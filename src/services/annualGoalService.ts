/**
 * Annual Goal Service - Manages yearly sales goals via /api/annual-goal endpoint
 * 
 * API Structure (from api-docs-7.json):
 * - manager_id, year, goal, mrr_goal
 * - q1, q2, q3, q4 (quarter values)
 * - jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec (monthly values)
 * - executives[] with executive_id, role, goal, mrr_goal, quarters and months
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://apiv2.opendata.center/api';
const AUTH_TOKEN_KEY = 'open_access_token';
const LEGACY_AUTH_TOKEN_KEY = 'open_api_token';

// Types matching the actual API structure
export interface AnnualGoalExecutive {
  id?: number;
  executive_id: number;
  role: string;
  goal: number;
  mrr_goal: number;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
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
  // Populated fields from API (with relations)
  executive?: {
    id: number;
    name: string;
    email: string;
  };
}

export interface AnnualGoal {
  id: number;
  uuid?: string;
  manager_id: number;
  year: number;
  goal: number;
  mrr_goal: number;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
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
  executives?: AnnualGoalExecutive[];
  manager?: {
    id: number;
    name: string;
    email: string;
  };
  created_at?: string;
  updated_at?: string;
}

export interface AnnualGoalStoreRequest {
  manager_id: number;
  year: number;
  goal: number;
  mrr_goal: number;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
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
  executives?: AnnualGoalExecutiveRequest[];
}

export interface AnnualGoalExecutiveRequest {
  executive_id: number;
  role: string;
  goal: number;
  mrr_goal: number;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
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
}

export interface AnnualGoalUpdateRequest {
  manager_id?: number;
  year?: number;
  goal?: number;
  mrr_goal?: number;
  q1?: number;
  q2?: number;
  q3?: number;
  q4?: number;
  jan?: number;
  feb?: number;
  mar?: number;
  apr?: number;
  may?: number;
  jun?: number;
  jul?: number;
  aug?: number;
  sep?: number;
  oct?: number;
  nov?: number;
  dec?: number;
  executives?: AnnualGoalExecutiveRequest[];
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
  manager_id?: number;
  __with?: string;
}): Promise<PaginatedResponse<AnnualGoal>> {
  const response = await axios.get<PaginatedResponse<AnnualGoal>>(`${API_BASE_URL}/annual-goal`, {
    params: {
      __perPage: 100,
      __with: 'executives,manager,executives.executive',
      ...params,
    },
    headers: getHeaders(),
  });
  return response.data;
}

/**
 * Fetch a specific annual goal by ID
 */
export async function fetchAnnualGoalById(id: number | string): Promise<AnnualGoal> {
  const response = await axios.get<AnnualGoal>(`${API_BASE_URL}/annual-goal/${id}`, {
    params: {
      __with: 'executives,manager,executives.executive',
    },
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
export async function updateAnnualGoal(id: number | string, data: AnnualGoalUpdateRequest): Promise<AnnualGoal> {
  const response = await axios.put<AnnualGoal>(`${API_BASE_URL}/annual-goal/${id}`, data, {
    headers: getHeaders(),
  });
  return response.data;
}

/**
 * Delete an annual goal
 */
export async function deleteAnnualGoal(id: number | string): Promise<void> {
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
