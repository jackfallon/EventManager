exports.handler = async (event) => {
  try {
    // startDate, endDate input from user
    const { startDate, endDate } = event.queryStringParameters;
    
    const pool = await getDbPool();
    const query = `
      SELECT * FROM events
      WHERE event_date BETWEEN $1 AND $2
      ORDER BY event_date;
    `;
    
    const result = await pool.query(query, [startDate, endDate]);

    return {
      statusCode: 200,
      body: JSON.stringify(result.rows),
    };
  } catch (error) {
    console.error('Error fetching events:', error);
    return {
      statusCode: 500,
      body: 'Internal server error',
    };
  }
};
