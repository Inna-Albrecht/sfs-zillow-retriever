import express from 'express';
import { handler } from './puppet.js';
import plivo from 'plivo'
import cors from 'cors'
import { PrismaClient } from '@prisma/client';
import bodyParser from 'body-parser';
const app = express();
app.use(express.json()); 

app.use((req, res, next) => {
  console.log(`Received ${req.method} request for ${req.url}`);
  console.log('Request Body:', req.body); 
  next(); 
});
app.use(bodyParser.json()); // Add this for parsing JSON payloads
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({
    origin: '*', // Allow only this origin
    methods: ['GET', 'POST'], // Specify the methods you want to allow
}));


const prisma = new PrismaClient(); 

/**
 * Route for scraping a webpage.
 * @name POST/scrape
 * @function
 * @param {Object} req - Express request object.
 * @param {string} req.body.url - The URL to scrape.
 * @param {Object} res - Express response object.
 */
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
/**
 * Route for sending outbound SMS using Plivo.
 * @name POST/outbound_sms
 * @function
 * @param {Object} req - Express request object.
 * @param {string} req.body.src - Source phone number.
 * @param {string} req.body.dst - Destination phone number.
 * @param {string} req.body.text - SMS message text.
 * @param {Object} res - Express response object.
 */
app.post('/outbound_sms/', async (req, res) => {
  let client = new plivo.Client(`${process.env.AUTH_ID}`, `${process.env.AUTH_TOKEN}`);

  // Log the request body to see what is being received
  console.log('%cserver.js:16 request body', 'color: #007acc;', req.body);

  // Extract data from the request body
  const { src, dst, text } = req.body;

  // Validate the required fields
  if (!src || !dst || !text) {
      return res.status(400).json({ error: 'Missing required fields' });
  }

  // Send SMS using Plivo
  try {
      const message_created = await client.messages.create(src, dst, text);
      console.log(message_created);

      // Insert log into the database
      const sql = `
          INSERT INTO tblcontact_history (contact_type, direction, from_number, to_number, message_body, timestamp)
          VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      await prisma.$queryRawUnsafe(sql,
          'sms',                // contact_type
          'outgoing',           // direction
          src,                  // from_number
          dst,                  // to_number
          text,                 // message_body
          new Date()            // Set current date and time for timestamp
      );

      console.log("Outgoing SMS logged.");
      return res.status(200).json({ success: 'Message sent successfully' });
  } catch (error) {
      console.error("Error sending message or logging:", error);
      return res.status(500).json({ error: 'Failed to send message' });
  }
});


/**
 * Route to get contact history based on staff ID and phone number.
 * @name POST/contact-history
 * @function
 * @param {Object} req - Express request object.
 * @param {string} req.body.staffid - The staff ID.
 * @param {string} req.body.phone_number - The phone number.
 * @param {Object} res - Express response object.
 */
app.post('/contact-history', async (req, res) => {
  const { staffid, phone_number } = req.body;

  // Construct the raw SQL query
  const query = `
      SELECT 
          s.staffid,
          s.firstname,
          s.lastname,
          pn.phone_number,
          ac.area_code,
          ac.state,
          ch.contact_type,
          ch.direction,
          ch.from_number,
          ch.to_number,
          ch.message_body,
          ch.timestamp
      FROM 
          tbluser_phone_numbers AS upn
      JOIN 
          tblphone_numbers AS pn ON upn.phone_number_id = pn.id
      JOIN 
          tblarea_codes AS ac ON pn.area_code_id = ac.id
      JOIN 
          tblstaff AS s ON upn.staffid = s.staffid
      LEFT JOIN 
          tblcontact_history AS ch ON pn.phone_number = ch.from_number OR pn.phone_number = ch.to_number
      WHERE 
          upn.staffid = ${staffid} AND pn.phone_number = '${phone_number}';
  `;

  try {
      console.log("Executing query with params:", staffid, phone_number);

      // Execute the raw query using Prisma
      const results = await prisma.$queryRawUnsafe(query); // Use $queryRawUnsafe to inject params safely

      console.log("Query Result:", results); // Log the raw results
      res.json(results.length > 0 ? results : "0");
  } catch (error) {
      console.error("Error fetching contact history:", error);
      res.status(500).json({ error: "Internal server error" });
  }
});
/**
 * Route to log incoming SMS.
 * @name POST/incoming-sms
 * @function
 * @param {Object} req - Express request object.
 * @param {string} req.body.from - Sender's phone number.
 * @param {string} req.body.to - Receiver's phone number.
 * @param {string} req.body.text - SMS message body.
 * @param {Object} res - Express response object.
 */
app.post('/incoming-sms', async (req, res) => {
  const { from, to, text } = req.body; // Extract values from the request body

  // Raw SQL query
  const sql = `
      INSERT INTO tblcontact_history (contact_type, direction, from_number, to_number, message_body, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
  `;

  try {
      await prisma.$queryRawUnsafe(sql,
          'sms',                // contact_type
          'incoming',           // direction
          from,                 // from_number
          to,                   // to_number
          text,                 // message_body
          new Date()            // Set current date and time for timestamp
      );

      console.log("Incoming SMS logged.");
      res.status(200).send("Message received");
  } catch (error) {
      console.error("Error logging incoming SMS:", error);
      res.status(500).send("Internal server error");
  }
});
/**
 * Route to log incoming call.
 * @name POST/incoming-call
 * @function
 * @param {Object} req - Express request object.
 * @param {string} req.body.from - Caller phone number.
 * @param {string} req.body.to - Receiver phone number.
 * @param {string} req.body.direction - Direction of the call.
 * @param {Object} res - Express response object.
 */
app.post('/incoming-call', async (req, res) => {
  const { from, to, direction } = req.body; // Extract values from the request body

  try {
      await prisma.$queryRawUnsafe(`
          INSERT INTO tblcontact_history (contact_type, direction, from_number, to_number, message_body, timestamp)
          VALUES ('call', '${direction}', '${from}', '${to}', NULL, NOW())
      `);

      console.log("Incoming call logged.");
      res.status(200).send("Call received");
  } catch (error) {
      console.error("Error logging incoming call:", error);
      res.status(500).send("Internal server error");
  }
});
/**
 * Route to fetch phone numbers assigned to a staff member.
 * @name POST/staffer_numbers
 * @function
 * @param {Object} req - Express request object.
 * @param {string} req.body.staffId - The staff ID.
 * @param {Object} res - Express response object.
 */
app.post('/staffer_numbers', async (req, res) => {
  const { staffId } = req.body; // Extract staffId from the request body

  try {
      const availableNumbers = await prisma.$queryRawUnsafe(`
          SELECT pn.phone_number
          FROM tbluser_phone_numbers upn
          JOIN tblphone_numbers pn ON upn.phone_number_id = pn.id
          WHERE upn.staffid = ${staffId}
          AND pn.enabled = 1
      `);

      console.log("Available phone numbers fetched:", availableNumbers);
      res.status(200).json(availableNumbers);
  } catch (error) {
      console.error("Error fetching available phone numbers:", error);
      res.status(500).send("Internal server error");
  }
});

/**
 * Route to fetch available phone numbers for a given destination number and staff ID.
 * @name POST/available-numbers
 * @function
 * @param {Object} req - Express request object.
 * @param {string} req.body.staffid - The staff ID.
 * @param {string} req.body.destination_number - The destination phone number.
 * @param {Object} res - Express response object.
 */
app.post('/available-numbers', async (req, res) => {
  const { staffid, destination_number } = req.body;

  // Extract the first three digits (area code) from the destination number
  const areaCode = destination_number.substring(0, 3);

  try {
      const result = await prisma.$queryRawUnsafe(`
          SELECT 
              pn.phone_number
          FROM 
              tbluser_phone_numbers AS upn
          JOIN 
              tblphone_numbers AS pn ON upn.phone_number_id = pn.id
          JOIN 
              tblarea_codes AS ac ON pn.area_code_id = ac.id
          WHERE 
              upn.staffid = ${staffid}
          AND 
              ac.state = (
                  SELECT state
                  FROM tblarea_codes
                  WHERE area_code = ${areaCode}
              )
          AND 
              pn.enabled = 1;
      `);

      res.status(200).json(result);
  } catch (error) {
      console.error("Error fetching available phone numbers:", error);
      res.status(500).send("Internal server error");
  }
});

app.post('/available-numbers-w-state', async (req, res) => {
  const { staffid, destination_number } = req.body;

  // Extract the first three digits (area code) from the destination number
  const cleanedNumber = destination_number.replace(/^\+?1[-.\s]?/, '').replace(/[^\d]/g, ''); // Remove country code and any non-digit characters

  const areaCode = cleanedNumber.substring(0, 3);

  try {
      const result = await prisma.$queryRawUnsafe(`
          SELECT 
              pn.phone_number,
              ac.state
          FROM 
              tbluser_phone_numbers AS upn
          JOIN 
              tblphone_numbers AS pn ON upn.phone_number_id = pn.id
          JOIN 
              tblarea_codes AS ac ON pn.area_code_id = ac.id
          WHERE 
              upn.staffid = ${staffid}
          AND 
              ac.state = (
                  SELECT state
                  FROM tblarea_codes
                  WHERE area_code = ${areaCode}
              )
          AND 
              pn.enabled = 1;
      `);

      res.status(200).json(result);
  } catch (error) {
      console.error("Error fetching available phone numbers:", error);
      res.status(500).send("Internal server error");
  }
});
/**
 * Route to fetch specific contact history between two numbers.
 * @name POST/specific-history
 * @function
 * @param {Object} req - Express request object.
 * @param {string} req.body.from_number - Originating phone number.
 * @param {string} req.body.to_number - Receiving phone number.
 * @param {Object} res - Express response object.
 */
app.post('/specific-history', async (req, res) => {
  const { fromNumber, toNumber } = req.body;

  console.log('Selected Number:', fromNumber);
  console.log('History Number:', toNumber);

  // Check for required parameters
  if (!fromNumber || !toNumber) {
      return res.status(400).json({ error: 'Missing required phone numbers' });
  }

  try {
      // Fetch contact history using raw SQL query
      const query = `
      SELECT *
      FROM tblcontact_history
      WHERE 
          (from_number = ${fromNumber} AND to_number = ${toNumber})
          OR (from_number = ${toNumber} AND to_number = ${fromNumber})
      ORDER BY timestamp DESC
      `;

      // Pass the parameters to the query
      const contactHistory = await prisma.$queryRawUnsafe(query);

      // Send back the contact history
      res.status(200).json(contactHistory);
  } catch (error) {
      console.error('Error fetching contact history:', error);
      res.status(500).json({ error: 'Failed to fetch contact history' });
  }
});


// Start the server
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
