import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LocationClient } from '@aws-sdk/client-location';
import { Amplify } from 'aws-amplify';
import { fetchAuthSession } from 'aws-amplify/auth';


interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  latitude: number;
  longitude: number;
  organizerId: string;
  maxParticipants: number;
  currentParticipants: number;
}

const Events: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchRadius, setSearchRadius] = useState<number>(10); // in kilometers
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          setError('Unable to get your location. Some features may be limited.');
        }
      );
    }

    fetchEvents();
  }, [searchRadius]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { tokens } = await fetchAuthSession();
      if (!tokens?.idToken) {
        throw new Error('Not authenticated');
      }
      const token = tokens.idToken.toString();
      const response = await axios.get('/api/events', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          lat: userLocation?.lat,
          lng: userLocation?.lng,
          radius: searchRadius
        }
      });
      setEvents(response.data);
    } catch (error) {
      console.error('Error fetching events:', error);
      setError('Failed to load events. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (eventId: string) => {
    try {
      const { tokens } = await fetchAuthSession();
      if (!tokens?.idToken) {
        throw new Error('Not authenticated');
      }
      const token = tokens.idToken.toString();
      await axios.post(`/api/events/${eventId}/signup`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Refresh events after signup
      fetchEvents();
    } catch (error) {
      console.error('Error signing up for event:', error);
      setError('Failed to sign up for event. Please try again.');
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">Nearby Events</h1>
        <div className="flex items-center mb-4">
          <label className="mr-2">Search radius (km):</label>
          <input
            type="number"
            value={searchRadius}
            onChange={(e) => setSearchRadius(Number(e.target.value))}
            className="border rounded px-2 py-1 w-24"
          />
        </div>
        {error && <div className="text-red-500 mb-4">{error}</div>}
      </div>

      {loading ? (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => {
            const distance = userLocation
              ? calculateDistance(
                  userLocation.lat,
                  userLocation.lng,
                  event.latitude,
                  event.longitude
                )
              : null;

            return (
              <div key={event.id} className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-2">{event.title}</h2>
                <p className="text-gray-600 mb-4">{event.description}</p>
                <div className="space-y-2">
                  <p><span className="font-medium">Date:</span> {new Date(event.date).toLocaleDateString()}</p>
                  <p><span className="font-medium">Location:</span> {event.location}</p>
                  {distance && (
                    <p><span className="font-medium">Distance:</span> {distance.toFixed(1)} km away</p>
                  )}
                  <p>
                    <span className="font-medium">Spots:</span> {event.currentParticipants}/{event.maxParticipants}
                  </p>
                </div>
                <button
                  onClick={() => handleSignup(event.id)}
                  disabled={event.currentParticipants >= event.maxParticipants}
                  className={`mt-4 w-full py-2 px-4 rounded ${
                    event.currentParticipants >= event.maxParticipants
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  {event.currentParticipants >= event.maxParticipants ? 'Event Full' : 'Sign Up'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Events;
