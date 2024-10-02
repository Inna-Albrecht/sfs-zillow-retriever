import chromium from 'chrome-aws-lambda';
import puppeteer from 'puppeteer';

const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_VERSION;

export const handler = async (event, context) => {
  const { queryStringParameters } = event;
  
  if (!queryStringParameters || !queryStringParameters.url) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing URL parameter' }),
    };
  }

  const url = queryStringParameters.url;

  const browser = await (isLambda ? chromium.puppeteer : puppeteer).launch({
    args: isLambda ? chromium.args : [],
    defaultViewport: chromium.defaultViewport,
    executablePath: isLambda
      ? await chromium.executablePath
      : puppeteer.executablePath(), 
    headless: true,
  });

  const page = await browser.newPage();

  try {
    
    await page.goto(url, { waitUntil: 'networkidle2' });
    //await page.waitForTimeout(5000);
    await page.setViewport({ width: 1080, height: 1024 });

    const zestimate = await page.evaluate(() => {
        const spans = Array.from(document.querySelectorAll('span'));
        const zestimateSpan = spans.find(span => span.innerText.includes('$'));
        return zestimateSpan ? zestimateSpan.innerText : 'Not found';
      });

    console.log('Zestimate:', zestimate);
    return {
      statusCode: 200,body: JSON.stringify({ zestimate: zestimate })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to extract info' }),
    };
  } finally {
    await browser.close();
  }
};

/** 
import chromium from 'chrome-aws-lambda';
import puppeteer from 'puppeteer';

const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_VERSION;

export const handler = async (event, context) => {
  const { queryStringParameters } = event;
  
  if (!queryStringParameters || !queryStringParameters.url) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing URL parameter' }),
    };
  }

  const url = queryStringParameters.url;

  const browser = await (isLambda ? chromium.puppeteer : puppeteer).launch({
    args: isLambda ? chromium.args : [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--window-position=0,0',
      '--ignore-certifcate-errors',
      '--ignore-certifcate-errors-spki-list',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu'
    ],
    defaultViewport: { width: 1280, height: 800 },
    executablePath: isLambda
      ? await chromium.executablePath
      : puppeteer.executablePath(),
    headless: true,
  });

  const page = await browser.newPage();

  try {
    // Set User Agent to mimic real browser
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36'
    );

    // Mock plugins and languages to match real browser behavior
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    });

    // Visit the Zillow URL
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Scrape Zestimate
    const zestimate = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span'));
      const zestimateSpan = spans.find(span => span.innerText.includes('$'));
      return zestimateSpan ? zestimateSpan.innerText : 'Not found';
    });

    console.log('Zestimate:', zestimate);
    return {
      statusCode: 200,
      body: JSON.stringify({ zestimate: zestimate }),
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to extract info' }),
    };
  } finally {
    await browser.close();
  }
};

*/