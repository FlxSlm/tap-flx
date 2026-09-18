import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from '../api/axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const checkAuth = async () => {
        try {
            const res = await axios.get('/api/user');
            setUser(res.data);
        } catch (error) {
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkAuth();
    }, []);

    const register = async (name, email, password, password_confirmation) => {
        await axios.get('/sanctum/csrf-cookie');
        const res = await axios.post('/register', { name, email, password, password_confirmation });
        setUser(res.data.user);
        return res;
    };

    const login = async (email, password) => {
        await axios.get('/sanctum/csrf-cookie'); // Get CSRF cookie first
        const res = await axios.post('/login', { email, password });
        setUser(res.data.user);
        return res;
    };

    const logout = async () => {
        await axios.post('/logout');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, register, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

