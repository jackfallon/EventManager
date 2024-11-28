const { getDbPool } = require('../utils/database');

exports.handler = async (event) => {
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

    // Query to return events specified by the co-ordinates from the user
    const query = `
      SELECT id, title, description, event_date, location_name, latitude, longitude, max_participants
      FROM events
      WHERE ST_DWithin(
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326), // Event location
        ST_SetSRID(ST_MakePoint($1, $2), 4326),              // User location
        notification_radius
      )
      ORDER BY event_date ASC
    `;

    const queryParams = [longitude, latitude];

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
