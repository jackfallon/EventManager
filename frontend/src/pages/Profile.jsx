import React, { useState, useEffect } from 'react';
import { getCurrentUser } from 'aws-amplify/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Profile = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const userInfo = await getCurrentUser();
      setUser(userInfo);
    } catch (error) {
      console.error('Error fetching user info:', error);
    }
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>User Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <p><strong>Username:</strong> {user.username}</p>
        <p><strong>Email:</strong> {user.attributes.email}</p>
        {/* Add more user information as needed */}
      </CardContent>
    </Card>
  );
};

export default Profile;

