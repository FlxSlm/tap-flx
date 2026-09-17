import React from 'react';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
    const { user, logout } = useAuth();

    return (
        <div style={{ maxWidth: '600px', margin: '100px auto', fontFamily: 'sans-serif' }}>
            <h2>Welcome to Dashboard</h2>
            <p>You are logged in as: <strong>{user?.name}</strong> ({user?.email})</p>
            <button onClick={logout} style={{ padding: '10px 15px', cursor: 'pointer' }}>Logout</button>
        </div>
    );
};

export default Dashboard;
