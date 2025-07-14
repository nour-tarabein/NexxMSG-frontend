export const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export const postRequest = async (endpoint, body) => {
    const token = localStorage.getItem('token');
    
    const headers = {
        "Content-Type": "application/json",
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${baseURL}/${endpoint}`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            return { error: true, message: data.message || "An error occurred." };
        }

        return data;

    } catch (error) {
        // This will catch network errors (e.g., server down) or JSON parsing errors
        return { error: true, message: error.message || "A network error occurred." };
    }
};

export const getRequest = async (endpoint) => {
    const token = localStorage.getItem('token');
    
    const headers = {};

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${baseURL}/${endpoint}`, {
            method: 'GET',
            headers: headers,
        });

        const data = await response.json();

        if (!response.ok) {
            return { error: true, message: data.message || "An error occurred." };
        }

        return data;
        
    } catch (error) {
        return { error: true, message: error.message || "A network error occurred." };
    }
};