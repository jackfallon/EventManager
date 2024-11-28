const { getDbPool } = require('../utils/database');
const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
  try {
    // Extract the JWT token from the Authorization header
    const token = event.headers.Authorization ? event.headers.Authorization.split(' ')[1] : null;

    if (!token) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Unauthorized: No token provided' })
      };
    }

    // Verify the token (you'll need to replace 'YOUR_COGNITO_PUBLIC_KEY' with your actual Cognito public key URL)
    const decoded = jwt.verify(token, 'YOUR_COGNITO_PUBLIC_KEY', (err, decoded) => {
      if (err) {
        return {
          statusCode: 401,
          body: JSON.stringify({ message: 'Unauthorized: Invalid token' })
        };
      }
      return decoded;
    });
    
  try {
    const pool = await getDbPool(); 
    
    // Extract query parameters for location
    const { latitude, longitude } = event.queryStringParameters;

    // Error if no latitude, longtitude are provided
    if (!latitude || !longitude) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Latitude and Longitude are required' })
      };
    }

    // Defining a Query to return events within the radoius of the user
    const query = `
      SELECT id, title, description, event_date, location_name, latitude, longitude, max_participants
      FROM events
      WHERE ST_DWithin(
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326), // user location
        ST_SetSRID(ST_MakePoint($1, $2), 4326),              // event location
        notification_radius
      )
      ORDER BY event_date ASC
    `;
    // Creates an array for all langtitude and longtitude to be replaced in the placeholders
    const queryParams = [longitude, latitude];
    // Executes the query
    const result = await pool.query(query, queryParams);

    // If no events are found
    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'No events found near your location.' })
      };
    }

    // Return events data
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' // Enable CORS for frontend requests
      },
      body: JSON.stringify(result.rows) // Send the event data
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
