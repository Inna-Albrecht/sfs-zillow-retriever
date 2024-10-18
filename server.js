import express from 'express';
import { handler } from './puppet.js';

const app = express();

app.use(express.json()); 

app.use((req, res, next) => {
  console.log(`Received ${req.method} request for ${req.url}`);
  console.log('Request Body:', req.body); 
  next(); 
});

app.post('/scrape', async (req, res) => {
  const { url } = req.body;  

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  /**
   * Event object containing query string parameters.
   * 
   * @typedef {Object} Event
   * @property {Object} queryStringParameters - The query string parameters.
   * @property {string} queryStringParameters.url - The URL parameter.
  */
  const event = {
    queryStringParameters: {
      url: `${url}`
    }
  };

  try {
    const response = await handler(event);

    // Log the response from the handler
    console.log('Handler Response:', response);

    // Check if response is valid and contains the expected properties
    if (response && typeof response.statusCode === 'number') {
      const body = JSON.parse(response.body);

      // Log the body being sent back
      console.log('Response Body:', body);

      // Send the response body as JSON
      res.status(response.statusCode).json(body);
    } else {
      console.error('Invalid response structure:', response);
      res.status(500).json({ error: 'Unknown error occurred' });
    }

  } catch (error) {
    console.error('Handler Error:', error);
    res.status(500).json({ error: 'Failed to scrape the data' });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
