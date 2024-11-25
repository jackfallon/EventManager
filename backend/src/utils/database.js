const { Pool } = require('pg');
const AWS = require('aws-sdk');

let pool;

async function getDbPool() {
  if (pool) {
    return pool;
  }

  const secretsManager = new AWS.SecretsManager();
  const secretData = await secretsManager
    .getSecretValue({ SecretId: process.env.DB_SECRET_ARN })
    .promise();
  
  const { username, password, host, port, dbname } = JSON.parse(secretData.SecretString);

  pool = new Pool({
    user: username,
    password: password,
    host: host,
    port: port,
    database: dbname,
    ssl: {
      rejectUnauthorized: false
    }
  });

  return pool;
}