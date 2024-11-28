const { getDbPool } = require('../utils/database'); // Assuming you have a database utility for connecting to DB

exports.handler = async (event) => {
  try {
    const pool = await getDbPool(); // Get database pool for querying
    
    // Check if the event ID or other filters are provided in the query
    const { eventId, latitude, longitude, maxResults = 10, page = 1 } = event.queryStringParameters;

    // Calculate offset for pagination (if needed)
    const offset = (page - 1) * maxResults;

    let query = `SELECT id, title, description, event_date, location_name, latitude, longitude, max_participants
                 FROM events
                 WHERE 1=1`; // Default condition to add additional filters
    
    let queryParams = [];
    
    if (eventId) {
      query += ` AND id = $1`;
      queryParams.push(eventId); // Add eventId as query parameter
    }

    if (latitude && longitude) {
      query += ` AND ST_DWithin(
                   ST_SetSRID(ST_MakePoint(longitude, latitude), 4326),
                   ST_SetSRID(ST_MakePoint($2, $3), 4326),
                   notification_radius
                 )`;
      queryParams.push(longitude, latitude); // Add location filters if present
    }

    query += ` ORDER BY event_date ASC
               LIMIT $4 OFFSET $5`; // Pagination parameters
    queryParams.push(maxResults, offset); // Add pagination parameters

    // Query to fetch events based on provided parameters
    const result = await pool.query(query, queryParams);
    
    // If no events are found
    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'No events found.' })
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
