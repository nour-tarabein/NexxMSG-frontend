export const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';


export async function postRequest(endpoint, body) {
  const response = await fetch(`${baseURL}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}


export async function getRequest(endpoint) {
  const response = await fetch(`${baseURL}/${endpoint}`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}
