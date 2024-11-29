const { getDbPool } = require('../utils/database');
const jwt = require('jsonwebtoken');
const AWS = require('aws-sdk'); // Initialize AWS SDK
const axios = require('axios');
const ssm = new AWS.SSM(); // Initialize SSM client
const COGNITO_REGION = 'us-east-1';
const jwkToPem = require('jwk-to-pem');

async function getCognitoPoolId() {
  const ssm = new AWS.SSM();
  const params = {
    Name: '/event-management/user-pool-id', // The name of the SSM parameter
    WithDecryption: true
  };
  const response = await ssm.getParameter(params).promise();
  return response.Parameter.Value;
}

// Helper function to verify JWT token
async function verifyToken(token, COGNITO_POOL_ID) {
  const url = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_POOL_ID}/.well-known/jwks.json`;
  const { data } = await axios.get(url);
  const decodedToken = jwt.decode(token, { complete: true });
  const key = data.keys.find(key => key.kid === decodedToken.header.kid);
  
  if (!key) throw new Error('Public key not found');
  
  const pem = jwkToPem(key);
  return jwt.verify(token, pem);
}
exports.handler = async (event) => {
  try {
    const COGNITO_POOL_ID = await getCognitoPoolId();
    
    const token = event.headers.Authorization || event.headers.authorization;
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ message: 'Authorization token required' }) };
    }

    const user = await verifyToken(token, COGNITO_POOL_ID); 

    
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
