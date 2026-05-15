import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://192.168.1.XXX:5000'; // Replace with Karthika's IP when she runs the backend

export const api = {
  async post(path, body) {
    const token = await AsyncStorage.getItem('token');
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    return res.json();
  },

  async get(path) {
    const token = await AsyncStorage.getItem('token');
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    return res.json();
  },
};