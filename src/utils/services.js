export const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export const postRequest = async (endpoint, body) => {
    // FIX: Retrieve token from localStorage
    const token = localStorage.getItem('token');
    
    const headers = {
        "Content-Type": "application/json",
    };

    // FIX: If a token exists, add the Authorization header
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${baseURL}/${endpoint}`, {
        method: 'POST',
        headers: headers, // Use the updated headers object
        body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
        let message = data.message || "An error occurred.";
        return { error: true, message };
    }

    return data;
};

export const getRequest = async (endpoint) => {
    const token = localStorage.getItem('token');
    
    const headers = {};

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${baseURL}/${endpoint}`, {
        method: 'GET',
        headers: headers,
    });

    const data = await response.json();

    if (!response.ok) {
        let message = data.message || "An error occurred.";
        return { error: true, message };
    }

    return data;
};