const express = require('express');
const axios = require('axios');
require('dotenv').config(); // Make sure your .env file is correctly set up

const app = express();
app.use(express.json()); // Middleware to parse JSON request bodies

// Destructure environment variables
const {
  CONSUMER_KEY,
  CONSUMER_SECRET,
  BUSINESS_SHORTCODE,
  PASSKEY,
  CALLBACK_URL
} = process.env;

/**
 * Fetches the M-Pesa API access token.
 * This token is required for authenticating subsequent M-Pesa API calls.
 * @returns {Promise<string>} The access token.
 */
const getAccessToken = async () => {
  // Combine CONSUMER_KEY and CONSUMER_SECRET, encode in Base64 for Basic Authorization.
  // Using template literals (backticks) for proper string interpolation.
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');

  try {
    const res = await axios.get('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      headers: {
        // Correctly form the Authorization header using a template literal.
        Authorization: `Basic ${auth}`
      }
    });
    // Return only the access token from the response data.
    return res.data.access_token;
  } catch (error) {
    console.error('Error fetching access token:', error.response?.data || error.message);
    throw new Error('Failed to get M-Pesa access token');
  }
};

/**
 * Generates a timestamp in YYYYMMDDHHmmss format.
 * This timestamp is used in the STK Push password generation.
 * @returns {string} The formatted timestamp.
 */
const getTimestamp = () => {
  const date = new Date();
  // Format date to 'YYYYMMDDHHmmss' string by removing non-numeric characters
  // and slicing to get the desired length.
  return date
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, -3); // Remove milliseconds
};

/**
 * Initiates an M-Pesa STK Push transaction.
 * @param {string} phone - The customer's phone number (e.g., 2547XXXXXXXX).
 * @param {number} amount - The amount to be transacted.
 * @param {string} accountRef - A unique identifier for the transaction (e.g., invoice number).
 * @param {string} transactionDesc - A description for the transaction.
 * @returns {Promise<object>} The response data from the STK Push API.
 */
const stkPush = async (phone, amount, accountRef, transactionDesc) => {
  const timestamp = getTimestamp();
  // Generate the password using BUSINESS_SHORTCODE, PASSKEY, and timestamp,
  // then encode it in Base64. Using template literals.
  const password = Buffer.from(`${BUSINESS_SHORTCODE}${PASSKEY}${timestamp}`).toString('base64');
  const token = await getAccessToken(); // Get the access token

  try {
    const res = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      {
        BusinessShortCode: BUSINESS_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline', // Or 'CustomerBuyGoodsOnline'
        Amount: amount,
        PartyA: phone, // Customer's phone number
        PartyB: BUSINESS_SHORTCODE, // Your business short code
        PhoneNumber: phone, // Customer's phone number
        CallBackURL: CALLBACK_URL, // URL where M-Pesa will send transaction status
        AccountReference: accountRef, // Your unique identifier for this transaction
        TransactionDesc: transactionDesc, // Description for the transaction
      },
      {
        headers: {
          // Correctly form the Authorization header with the Bearer token.
          Authorization: `Bearer ${token}`
        }
      }
    );
    return res.data;
  } catch (error) {
    console.error('STK Push Request Error:', error.response?.data || error.message);
    throw new Error('Failed to initiate STK Push');
  }
};

// Define the STK Push API endpoint
app.post('/stkpush', async (req, res) => {
  // Extract parameters from the request body
  const { phone, amount, reference, description } = req.body;

  // Basic validation (you might want more robust validation)
  if (!phone || !amount || !reference || !description) {
    return res.status(400).json({ error: 'Missing required parameters: phone, amount, reference, description' });
  }

  try {
    // Call the stkPush function to initiate the transaction
    const response = await stkPush(phone, amount, reference, description);
    res.status(200).json(response);
  } catch (error) {
    console.error('STK Push Endpoint Error:', error.message);
    // Send a more specific error response if possible
    res.status(500).json({ error: error.message || 'STK Push failed' });
  }
});

// Optional: Mock callback endpoint for M-Pesa to send transaction status updates.
// This is crucial for knowing the final status of a transaction.
app.post('/callback', (req, res) => {
  console.log('--- M-Pesa STK Callback Received ---');
  console.log('Callback Body:', JSON.stringify(req.body, null, 2)); // Log the full callback body
  // You should parse and process this data to update your system's transaction status.
  // M-Pesa expects a 200 OK response to confirm successful receipt of the callback.
  res.sendStatus(200);
});

// Define the port for the Express server.
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  // Correctly log the server port using a template literal.
  console.log(`Server running on port ${PORT}`)
);
