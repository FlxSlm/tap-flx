import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const Dashboard = () => {
    const { user, logout } = useAuth();

    return (
        <div style={{ maxWidth: '600px', margin: '100px auto', fontFamily: 'sans-serif', textAlign: 'center' }}>
            <h2>Welcome to Dashboard</h2>
            <p style={{ marginBottom: '20px' }}>You are logged in as: <strong>{user?.name}</strong> ({user?.email})</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <Link to="/transactions" style={{ padding: '10px 15px', background: '#aa3bff', color: 'white', textDecoration: 'none', borderRadius: '5px' }}>
                    View Transactions
                </Link>
                <button onClick={logout} style={{ padding: '10px 15px', cursor: 'pointer', border: '1px solid #ccc', background: 'white', borderRadius: '5px' }}>
                    Logout
                </button>
            </div>
        </div>
    );
};

export default Dashboard;
