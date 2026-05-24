const fetch = require('node-fetch');

async function test() {
  const url = 'http://127.0.0.1:8090/api/muse/guest';

  // Test 1: No auth header, no body
  console.log('Test 1: POST with no auth, no body');
  let resp = await fetch(url, { method: 'POST' });
  let body = await resp.json();
  console.log('Status:', resp.status, 'Response:', body.record ? 'OK' : 'FAIL');

  // Test 2: With invalid auth header
  console.log('\nTest 2: POST with invalid auth token');
  resp = await fetch(url, { method: 'POST', headers: { 'Authorization': 'invalid_token_12345' } });
  body = await resp.json();
  console.log('Status:', resp.status, 'Response:', body.record ? 'OK' : 'FAIL', 'Error:', body.message);

  // Test 3: With expired-looking JWT
  console.log('\nTest 3: POST with expired JWT');
  const expiredJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjb2xsZWN0aW9uSWQiOiJfcGJfdXNlcnNfYXV0aF8iLCJleHAiOjE2MDAwMDAwMDAsImlkIjoidGVzdDEyMyIsInJlZnJlc2hhYmxlIjp0cnVlLCJ0eXBlIjoiYXV0aCJ9.invalid_signature';
  resp = await fetch(url, { method: 'POST', headers: { 'Authorization': expiredJwt } });
  body = await resp.json();
  console.log('Status:', resp.status, 'Response:', body.record ? 'OK' : 'FAIL', 'Error:', body.message);
}

test().catch(console.error);
