const { getDbPool } = require('../utils/database');
const AWS = require('aws-sdk');
const sns = new AWS.SNS();
const location = new AWS.Location();

exports.handler = async (event) => {
  try {
    const pool = await getDbPool();
    const { title, description, eventDate, locationName, latitude, longitude, maxParticipants } = JSON.parse(event.body);
    const userId = event.requestContext.authorizer.claims.sub;

    const distance = calculateDistance(userLatitude, userLongitude, latitude, longitude);
    
    // Create event
    const result = await pool.query(
      `INSERT INTO events (
        title, description, event_date, location_name, latitude, longitude,
        created_by, max_participants, distance_from_user
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [title, description, eventDate, locationName, latitude, longitude, userId, maxParticipants, distance]
    );

    const newEvent = result.rows[0];

    // Find nearby users
    const nearbyUsers = await pool.query(
      `SELECT id, cognito_id 
       FROM users 
       WHERE ST_DWithin(
         ST_SetSRID(ST_MakePoint(longitude, latitude), 4326),
         ST_SetSRID(ST_MakePoint($1, $2), 4326),
         notification_radius
       )`,
      [longitude, latitude]
    );

    // Notify nearby users
    if (nearbyUsers.rows.length > 0) {
      await sns.publish({
        TopicArn: process.env.SNS_TOPIC_ARN,
        Message: JSON.stringify({
          type: 'NEW_EVENT',
          event: newEvent,
          users: nearbyUsers.rows
        })
      }).promise();
    }

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ event: newEvent, distance })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
