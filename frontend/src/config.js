// Normalizes the base URL by stripping any trailing slash
const rawUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const API_BASE_URL = rawUrl.replace(/\/+$/, '');

export default API_BASE_URL;

