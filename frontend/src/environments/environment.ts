
// Auto-detect environment based on hostname
const isProduction = typeof window !== 'undefined' &&
  (window.location.hostname === 'medhikaa.vercel.app' ||
   window.location.hostname.includes('vercel.app'));

export const environment = {
  production: isProduction,
  apiUrl: isProduction ? 'https://medhikaa.onrender.com/api' : 'http://localhost:3000/api',
  socketUrl: isProduction ? 'https://medhikaa.onrender.com' : 'http://localhost:3000',
  frontendUrl: isProduction ? 'https://medhikaa.vercel.app' : 'http://localhost:4200',
  stripePublishableKey: 'pk_test_51S2M7pBiOdK8gYs8ynQUFp3zDcwxtTFeeFJguXFwiTJixcEBSS7O7hccLXzNeSQnelTQL2YOS4TfrJgkj3XWQadi0015BKbYKr',
  zoomClientId: 'your_zoom_client_id',
  appName: 'SkillSwap',
  version: '1.0.0'
};