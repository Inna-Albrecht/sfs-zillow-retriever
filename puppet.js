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
    headless: false,
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
      statusCode: 200,
      body: JSON.stringify({ message: zestimate })
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

// Testing locally
const event = {
  queryStringParameters: {
    url: 'https://www.zillow.com/homedetails/1304-Nueces-Ct-Benbrook-TX-76126/29131088_zpid/'
  }
};

handler(event).then(response => {
  console.log('Response:', response);
}).catch(error => {
  console.error('Handler Error:', error);
});
