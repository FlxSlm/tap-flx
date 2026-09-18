import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const Register = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [errors, setErrors] = useState({});
    const [generalError, setGeneralError] = useState('');
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrors({});
        setGeneralError('');
        try {
            await register(
                name.trim(),
                email.trim(),
                password,
                passwordConfirmation
            );
            navigate('/');
        } catch (err) {
            if (err.response?.status === 422 && err.response?.data?.errors) {
                setErrors(err.response.data.errors);
            } else {
                setGeneralError(err.response?.data?.message || 'Registration failed');
            }
        }
    };

    return (
        <div style={{ maxWidth: '400px', margin: '100px auto', fontFamily: 'sans-serif' }}>
            <h2>Register</h2>
            {generalError && <div style={{ color: 'red', marginBottom: '10px' }}>{generalError}</div>}
            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '10px' }}>
                    <label>Name</label><br />
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px' }}
                    />
                    {errors.name && <div style={{ color: 'red', fontSize: '13px' }}>{errors.name[0]}</div>}
                </div>
                <div style={{ marginBottom: '10px' }}>
                    <label>Email</label><br />
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px' }}
                    />
                    {errors.email && <div style={{ color: 'red', fontSize: '13px' }}>{errors.email[0]}</div>}
                </div>
                <div style={{ marginBottom: '10px' }}>
                    <label>Password</label><br />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px' }}
                    />
                    {errors.password && <div style={{ color: 'red', fontSize: '13px' }}>{errors.password[0]}</div>}
                </div>
                <div style={{ marginBottom: '10px' }}>
                    <label>Password Confirmation</label><br />
                    <input
                        type="password"
                        value={passwordConfirmation}
                        onChange={(e) => setPasswordConfirmation(e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px' }}
                    />
                </div>
                <button type="submit" style={{ padding: '10px 15px', cursor: 'pointer' }}>Register</button>
            </form>
            <p style={{ marginTop: '15px' }}>
                Already have an account? <Link to="/login">Login</Link>
            </p>
        </div>
    );
};

export default Register;
