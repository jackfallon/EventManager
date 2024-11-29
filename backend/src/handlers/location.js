exports.calculateDistance = (userLatitude, userLongitude, eventLatitude, eventLongitude) => {
  const R = 6371; // Earth radius in km
  const toRadians = (deg) => deg * (Math.PI / 180);

  const φ1 = toRadians(userLatitude), φ2 = toRadians(eventLatitude);
  const Δφ = toRadians(eventLatitude - userLatitude), Δλ = toRadians(eventLongitude - userLongitude);

  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in km
};
