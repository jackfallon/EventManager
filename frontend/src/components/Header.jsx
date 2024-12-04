import React from 'react';
import { Link } from 'react-router-dom';
import { signOut } from 'aws-amplify/auth';
import { Button } from '@/components/ui/button';

const Header = () => {
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out: ', error);
    }
  };

  return (
    <header className="bg-white shadow-md">
      <nav className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold text-blue-600">EventHub</Link>
        <div className="space-x-4">
          <Link to="/" className="text-gray-600 hover:text-blue-600">Home</Link>
          <Link to="/events" className="text-gray-600 hover:text-blue-600">Events</Link>
          <Link to="/create-event" className="text-gray-600 hover:text-blue-600">Create Event</Link>
          <Link to="/profile" className="text-gray-600 hover:text-blue-600">Profile</Link>
          <Button onClick={handleSignOut} variant="outline">Sign Out</Button>
        </div>
      </nav>
    </header>
  );
};

export default Header;