import React, { useState } from 'react';
import { post } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const CreateEvent = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    location: '',
    maxParticipants: 10
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
  
    try {
      const session = await fetchAuthSession();
      if (!session.tokens) {
        throw new Error('No valid authentication');
      }
  
      const response = await post({
        apiName: 'eventsApi',
        path: '/events',
        options: {
          body: formData,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.tokens.idToken.toString()}`
          }
        }
      });
  
      if (response.statusCode === 201) {
        navigate('/events');
      } else {
        throw new Error('Failed to create event');
      }
    } catch (err) {
      console.error('Error creating event:', err);
      setError('Failed to create event. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Create New Event</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                name="title"
                placeholder="Event Title"
                value={formData.title}
                onChange={handleInputChange}
                required
              />
            </div>
            <div>
              <Textarea
                name="description"
                placeholder="Event Description"
                value={formData.description}
                onChange={handleInputChange}
                required
              />
            </div>
            <div>
              <Input
                type="datetime-local"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                required
              />
            </div>
            <div>
              <Input
                name="location"
                placeholder="Event Location"
                value={formData.location}
                onChange={handleInputChange}
                required
              />
            </div>
            <div>
              <Input
                type="number"
                name="maxParticipants"
                placeholder="Maximum Participants"
                value={formData.maxParticipants}
                onChange={handleInputChange}
                required
                min="1"
              />
            </div>
            {error && <div className="text-red-500">{error}</div>}
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Event'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateEvent;
