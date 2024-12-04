import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const api = generateClient();

const MyEvents = () => {
  const [myEvents, setMyEvents] = useState([]);
  const [editingEvent, setEditingEvent] = useState(null);

  useEffect(() => {
    fetchMyEvents();
  }, []);

  const fetchMyEvents = async () => {
    try {
      const response = await api.get('eventsApi', '/events/my-events');
      setMyEvents(response);
    } catch (error) {
      console.error('Error fetching my events:', error);
    }
  };

  const handleDelete = async (eventId) => {
    try {
      await api.del('eventsApi', `/events/${eventId}`);
      fetchMyEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const handleEdit = async (event) => {
    setEditingEvent(event);
  };

  const handleUpdate = async (updatedEvent) => {
    try {
      await api.put('eventsApi', `/events/${updatedEvent.id}`, { body: updatedEvent });
      setEditingEvent(null);
      fetchMyEvents();
    } catch (error) {
      console.error('Error updating event:', error);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">My Events</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {myEvents.map((event) => (
          <Card key={event.id}>
            <CardHeader>
              <CardTitle>{event.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-2">{event.description}</p>
              <p className="text-sm text-gray-500 mb-2">
                {new Date(event.date).toLocaleDateString()}
              </p>
              <p className="text-sm text-gray-500 mb-4">{event.location}</p>
              <div className="flex space-x-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button onClick={() => handleEdit(event)}>Edit</Button>
                  </DialogTrigger>
                  {editingEvent && editingEvent.id === event.id && (
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Event</DialogTitle>
                      </DialogHeader>
                      <EditEventForm event={editingEvent} onUpdate={handleUpdate} />
                    </DialogContent>
                  )}
                </Dialog>
                <Button variant="destructive" onClick={() => handleDelete(event.id)}>
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

const EditEventForm = ({ event, onUpdate }) => {
  const [formData, setFormData] = useState(event);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Input
          type="text"
          name="title"
          value={formData.title}
          onChange={handleChange}
          placeholder="Event Title"
          required
        />
      </div>
      <div>
        <Textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Event Description"
          required
        />
      </div>
      <div>
        <Input
          type="datetime-local"
          name="date"
          value={formData.date}
          onChange={handleChange}
          required
        />
      </div>
      <div>
        <Input
          type="text"
          name="location"
          value={formData.location}
          onChange={handleChange}
          placeholder="Event Location"
          required
        />
      </div>
      <Button type="submit">Update Event</Button>
    </form>
  );
};

export default MyEvents;
