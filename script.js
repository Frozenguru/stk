const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const {
  CONSUMER_KEY,
  CONSUMER_SECRET,
  BUSINESS_SHORTCODE,
  PASSKEY,
  CALLBACK_URL
} = process.env;

const getAccessToken = async () => {
  const auth = Buffer.from(${CONSUMER_KEY}:${CONSUMER_SECRET}).toString('base64');
  const res = await axios.get('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
    headers: {
      Authorization: Basic ${auth}
    }
  });
  return res.data.access_token;
};

const getTimestamp = () => {
  const date = new Date();
  return date
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, -3);
};

const stkPush = async (phone, amount, accountRef, transactionDesc) => {
  const timestamp = getTimestamp();
  const password = Buffer.from(${BUSINESS_SHORTCODE}${PASSKEY}${timestamp}).toString('base64');
  const token = await getAccessToken();

  const res = await axios.post(
    'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    {
      BusinessShortCode: BUSINESS_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: BUSINESS_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: CALLBACK_URL,
      AccountReference: accountRef,
      TransactionDesc: transactionDesc,
    },
    {
      headers: {
        Authorization: Bearer ${token}
      }
    }
  );

  return res.data;
};

app.post('/stkpush', async (req, res) => {
  const { phone, amount, reference, description } = req.body;

  try {
    const response = await stkPush(phone, amount, reference, description);
    res.status(200).json(response);
  } catch (error) {
    console.error('STK Push Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'STK Push failed' });
  }
});

// Optional: Mock callback endpoint
app.post('/callback', (req, res) => {
  console.log('STK Callback:', req.body);
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(Server running on port ${PORT}));