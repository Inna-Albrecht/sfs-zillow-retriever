import chromium from 'chrome-aws-lambda'

export const handler = async (event, context) => {
    const browser = await chromium.puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath,
        //headless: chromium.headless,
    })

    const page = await browser.newPage()

    const { url } = event.queryStringParameters;

    try {
        await page.goto(url, { waitUntil: 'networkidle2' });
        await page.setViewport({ width: 1080, height: 1024 });


        const zestimate = await page.$eval(
            'span.Text-c11n-8-99-3__sc-aiai24-0.dFhjAe span',
            el => el.innerText
        );
        console.log('%cpuppet.js:24 zestimate', 'color: #007acc;', zestimate);
        return {
            statuscode: 200,
            body: JSON.stringify({ message: zestimate })
        }
    } catch (error) {
        console.error('Error:', error);

        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to extract info' }),
        };
    } finally {
        await browser.close()
    }

}

handler()