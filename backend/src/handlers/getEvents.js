const { getDbPool } = require('../utils/database');
const jwt = require('jsonwebtoken');
const AWS = require('aws-sdk'); // Initialize AWS SDK
const axios = require('axios');
const ssm = new AWS.SSM(); // Initialize SSM client
const COGNITO_REGION = 'us-east-1';

async function getCognitoPoolId() {
  const params = {
    Name: '/event-management/user-pool-id', // The name of the SSM parameter
    WithDecryption: true
  };
  const response = await ssm.getParameter(params).promise();
  return response.Parameter.Value;
}
async function getCognitoPublicKey(poolId) {
  const url = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${poolId}/.well-known/jwks.json`;
  const response = await axios.get(url);
  return response.data.keys;
}
exports.handler = async (event) => {
  try {
     const COGNITO_POOL_ID = await getCognitoPoolId();
    const { Authorization } = event.headers;
    const token = Authorization ? Authorization.split(' ')[1] : null;

    if (!token) return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized: No token provided' }) };

    const decodedToken = jwt.decode(token, { complete: true });
    if (!decodedToken?.header?.kid) return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized: Invalid token header' }) };

    const { data: { keys } } = await axios.get(`https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_POOL_ID}/.well-known/jwks.json`);
    const key = keys.find(k => k.kid === decodedToken.header.kid);
    if (!key) return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized: Key not found' }) };

    const publicKey = jwt.constructPublicKey(key);
    jwt.verify(token, publicKey, (err, decoded) => {
      if (err) return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized: Invalid token' }) };
    });

    
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
