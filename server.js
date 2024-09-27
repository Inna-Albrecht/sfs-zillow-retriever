import express from 'express';
import { handler } from './puppet.js';  

const app = express();

app.use(express.json());

app.post('/scrape', async (req, res) => {
  const { url } = req.body;  

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const event = {
    queryStringParameters: {
      url: `${url}`
    }
  };

  try {
    const response = await handler(event);

    if (response && response.statuscode) {
      res.status(response.statuscode).json(JSON.parse(response.body));  
    } else {
      res.status(500).json({ error: 'Unknown error occurred' });
    }

  } catch (error) {
    console.error('Handler Error:', error);
    res.status(500).json({ error: 'Failed to scrape the data' });  
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
