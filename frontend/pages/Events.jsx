import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const api = generateClient();

const Events = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('eventsApi', '/events');
      setEvents(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Error fetching events:', error);
      setError('Failed to fetch events. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (eventId) => {
    try {
      await api.post('eventsApi', `/events/${eventId}/signup`);
      fetchEvents();
    } catch (error) {
      console.error('Error signing up for event:', error);
      setError('Failed to sign up for event. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <p>Loading events...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <p>No events found. Check back later!</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <Card key={event.id} className="flex flex-col">
          <CardHeader>
            <CardTitle>{event.title}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <p className="text-sm text-gray-600 mb-2">{event.description}</p>
            <p className="text-sm">📍 {event.location}</p>
            <p className="text-sm">📅 {new Date(event.date).toLocaleDateString()}</p>
          </CardContent>
          <div className="p-4 mt-auto">
            <Button 
              onClick={() => handleSignUp(event.id)}
              className="w-full"
            >
              Sign Up
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default Events;