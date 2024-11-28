exports.handler = async (event) => {
  try {
    const { userLatitude, userLongitude, eventLatitude, eventLongitude } = JSON.parse(event.body);

    const R = 6371; // Earth radius in km
    const toRadians = (deg) => deg * (Math.PI / 180);
    
    const φ1 = toRadians(userLatitude), φ2 = toRadians(eventLatitude);
    const Δφ = toRadians(eventLatitude - userLatitude), Δλ = toRadians(eventLongitude - userLongitude);
    
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    const distance = R * c; // Distance in km
    return { statusCode: 200, body: JSON.stringify({ distance }) };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: 'Internal server error' };
  }
};
