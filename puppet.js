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
    headless: false,  // Set headless to true to avoid opening a browser window
  });

  const page = await browser.newPage();

  try {
    // Navigate to the specified URL
    await page.goto(url, { waitUntil: 'networkidle2' });
    await page.setViewport({ width: 1080, height: 1024 });

    // Extract Zestimate value
    const zestimate = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span'));
      const zestimateSpan = spans.find(span => span.innerText.includes('$'));
      return zestimateSpan ? zestimateSpan.innerText : 'Not found';
    });

    // Extract Property Details (Property Type, Year Built, Acreage)
    const propertyDetails = await page.evaluate(() => {
      const ulElement = document.querySelector('ul.dpf__sc-xzpkxd-0.fZHAmk');

      if (!ulElement) {
        return { propertyType: 'Not found', yearBuilt: 'Not found', acreage: 'Not found' };
      }

      const targetSpans = Array.from(ulElement.querySelectorAll('span')).filter(span =>
        span.className.includes('kOlNqB')
      );

      const spanTexts = targetSpans.map(span => span.innerText);

      const propertyType = spanTexts[0] || 'Property type not found';
      const yearBuilt = spanTexts[1] || 'Year built not found';
      const acreage = spanTexts[spanTexts.length - 1] || 'Acreage not found';

      return {
        propertyType,
        yearBuilt,
        acreage,
      };
    });

    // Log the extracted data
    console.log('Zestimate:', zestimate);
    console.log('Property Details:', propertyDetails);

    // Return both Zestimate and Property Details in the response
    return {
      statusCode: 200,
      body: JSON.stringify({
        zestimate: zestimate,
        propertyDetails: propertyDetails,
      }),
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
