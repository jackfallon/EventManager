import React, { useState, useEffect } from 'react';
import { get } from 'aws-amplify/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const Home = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await get({
        apiName: 'eventsApi',
        path: '/events'
      }).response;

      const data = await response.body.json();
      
      if (!data || !Array.isArray(data)) {
        setEvents([]);
        toast({
          title: "Info",
          description: "No events found."
        });
      } else {
        setEvents(data);
        if (data.length === 0) {
          toast({
            title: "Info",
            description: "No events available."
          });
        }
      }
    } catch (err) {
      console.error('Error fetching events:', err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch events, please try again later"
      });
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Available Events</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading events...</p>
          ) : events.length === 0 ? (
            <p>No events available. Why not create one?</p>
          ) : (
            <div className="grid gap-4">
              {events.map((event) => (
                <Card key={event.id}>
                  <CardContent className="p-4">
                    <h3 className="font-bold">{event.title}</h3>
                    <p>{event.description}</p>
                    <p>Date: {new Date(event.event_date).toLocaleDateString()}</p>
                    <p>Location: {event.location_name}</p>
                    <p>Participants: {event.current_participants || 0}/{event.max_participants}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Home;