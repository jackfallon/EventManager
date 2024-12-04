import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import { withAuthenticator } from '@aws-amplify/ui-react';
import awsconfig from './aws-exports';
import Header from './components/Header';
import Home from './pages/Home';
import Events from './pages/Events';
import CreateEvent from './pages/CreateEvent';
import Profile from './pages/Profile';
import MyEvents from './pages/MyEvents';

Amplify.configure(awsconfig);

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route exact path="/" element={<Home/>} />
            <Route path="/events" element={<Events/>} />
            <Route path="/create-event" element={<CreateEvent/>} />
            <Route path="/profile" element={<Profile/>} />
            <Route path="/my-events" element={<MyEvents/>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default withAuthenticator(App);
