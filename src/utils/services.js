// src/utils/services.js
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const getAuthHeaders = (token = null) => {
  const storedToken = token || localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (storedToken) {
    headers['Authorization'] = `Bearer ${storedToken}`;
  }
  
  return headers;
};

export const getRequest = async (url, token = null) => {
  try {
    const response = await fetch(`${API_URL}/${url}`, {
      method: 'GET',
      headers: getAuthHeaders(token),
      credentials: 'include', 
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
      
      return { error: true, message: data.message || 'Request failed' };
    }

    return data;
  } catch (error) {
    console.error('GET request error:', error);
    return { error: true, message: error.message };
  }
};

export const postRequest = async (url, body, token = null) => {
  try {
    const response = await fetch(`${API_URL}/${url}`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      credentials: 'include',
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
      
      return { error: true, message: data.message || 'Request failed' };
    }

    return data;
  } catch (error) {
    console.error('POST request error:', error);
    return { error: true, message: error.message };
  }
};