const { getDbPool } = require('../utils/database');
const AWS = require('aws-sdk');
const sns = new AWS.SNS();
const jwt = require('jsonwebtoken');
const axios = require('axios');
const jwkToPem = require('jwk-to-pem');

const COGNITO_POOL_ID = 'COGNITO_POOL_ID'; // replace with pool ID
const COGNITO_REGION = 'COGNITO_REGION'; // replace with region

exports.handler = async (event) => {
  try {
    //Extract and verify the token
    const token = event.headers.Authorization || event.headers.authorization;
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ message: 'Authorization token required' }) };
    }

    const user = await verifyToken(token); // Verify JWT token

    // Parse event data from the request body
    const { title, description, eventDate, locationName, latitude, longitude, maxParticipants } = JSON.parse(event.body);

    // Insert event into database
    const pool = await getDbPool();
    const result = await pool.query(
      `INSERT INTO events (title, description, event_date, location_name, latitude, longitude, created_by, max_participants) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [title, description, eventDate, locationName, latitude, longitude, user.sub, maxParticipants]
    );

    const newEvent = result.rows[0];

    // Find nearby users (simplified)
    const nearbyUsers = await pool.query(
      `SELECT id, cognito_id FROM users 
       WHERE ST_DWithin(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326), 
                        ST_SetSRID(ST_MakePoint($1, $2), 4326), notification_radius)`,
      [longitude, latitude]
    );

    // Notify nearby users if any
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
      body: JSON.stringify(newEvent)
    };

  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};

// Helper function to verify JWT token
async function verifyToken(token) {
  const url = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_POOL_ID}/.well-known/jwks.json`;
  const { data } = await axios.get(url);
  const decodedToken = jwt.decode(token, { complete: true });
  const key = data.keys.find(key => key.kid === decodedToken.header.kid);
  
  if (!key) throw new Error('Public key not found');
  
  const pem = jwkToPem(key);
  return jwt.verify(token, pem);
}
