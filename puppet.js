import chromium from 'chrome-aws-lambda';
import puppeteer from 'puppeteer';

const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_VERSION;

export const handler = async (event, context) => {
  const { queryStringParameters } = event;

  if (!queryStringParameters || !queryStringParameters.url) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        code: 1,
        data: null,
        message: 'Missing URL parameter',
      }),
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
    await page.goto(url);

    // Wait for the `ul.dpf__sc-xzpkxd-0.fZHAmk` element to be available
    await page.waitForSelector('ul.dpf__sc-xzpkxd-0.fZHAmk');

    const zestimate = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span'));
      const zestimateSpan = spans.find(span => span.innerText.includes('$'));
      return zestimateSpan ? zestimateSpan.innerText : 'Not found';
    });

    const data = await page.evaluate(() => {
      const targetSpans = Array.from(document.querySelectorAll('span.Text-c11n-8-99-3__sc-aiai24-0.dFxMdJ'));

      const bed = targetSpans[0] ? targetSpans[0].innerText : 'Beds not found';
      const baths = targetSpans[1] ? targetSpans[1].innerText : 'Baths not found';
      const squareFootage = targetSpans[2] ? targetSpans[2].innerText : 'Square footage not found';

      const ulElement = document.querySelector('ul.dpf__sc-xzpkxd-0.fZHAmk');
      const propertySpans = Array.from(ulElement.querySelectorAll('span')).filter(span =>
        span.className.includes('kOlNqB')
      );

      const spanTexts = propertySpans.map(span => span.innerText);

      const propertyType = spanTexts[0] || 'Property type not found';
      const yearBuilt = spanTexts[1] || 'Year built not found';
      const acreage = spanTexts[spanTexts.length - 1] || 'Acreage not found';

      return {
        propertyType,
        yearBuilt,
        acreage,
        bed,
        baths,
        squareFootage,
      };
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        code: 0,
        data: { zestimate, propertyDetails: data },
        message: 'Scraping successful',
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        code: 1,
        data: null,
        message: 'Failed to extract info',
      }),
    };
  } finally {
    await browser.close();
  }
};
