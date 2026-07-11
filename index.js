const { chromium } = require("playwright");
const axios = require("axios");
const fs = require("fs");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const URL = "https://www.goodreturns.in/gold-rates/bhubaneswar.html";

(async () => {

    let browser;

    try {

        browser = await chromium.launch({
            headless: true,
            args: [
                "--disable-dev-shm-usage",
                "--no-sandbox",
                "--disable-setuid-sandbox"
            ]
        });

        const context = await browser.newContext({

            viewport: {
                width: 1366,
                height: 768
            },

            userAgent:
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138 Safari/537.36"

        });

        const page = await context.newPage();

        // Block heavy resources
        await page.route("**/*", (route) => {

            const type = route.request().resourceType();

            if (
                type === "image" ||
                type === "media" ||
                type === "font"
            ) {
                return route.abort();
            }

            route.continue();

        });

        console.log("Opening website...");

        await page.goto(URL, {
            waitUntil: "domcontentloaded",
            timeout: 120000
        });

        await page.waitForTimeout(8000);

        // Save page for debugging
        fs.writeFileSync("page.html", await page.content());

        await page.screenshot({
            path: "page.png",
            fullPage: true
        });

        console.log("Searching for price...");

        // Try multiple selectors
        const selectors = [
            "#24K-price",
            "[id='24K-price']",
            ".gold_summ_price",
            ".gold-rate",
            "table"
        ];

        let price = null;

        for (const selector of selectors) {

            try {

                if (await page.locator(selector).count()) {

                    const text = await page.locator(selector).first().innerText();

                    const match = text.match(/₹\s?([\d,]+)/);

                    if (match) {
                        price = "₹" + match[1];
                        break;
                    }

                }

            } catch (e) {}

        }

        if (!price) {

            const html = await page.content();

            const match = html.match(/24K[\s\S]{0,500}?₹\s?([\d,]+)/i);

            if (match)
                price = "₹" + match[1];

        }

        if (!price)
            throw new Error("24K price not found.");

        console.log("Price =", price);

        let previous = "";

        if (fs.existsSync("price.json")) {

            previous = JSON.parse(
                fs.readFileSync("price.json")
            ).lastPrice;

        }

        if (price !== previous) {

            await axios.post(

                `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,

                {

                    chat_id: CHAT_ID,

                    text:
`🏆 Bhubaneswar Gold Price

24K Gold

${price} / gram

Previous : ${previous || "N/A"}

Current : ${price}

Updated :
${new Date().toLocaleString("en-IN")}

${URL}`

                }

            );

            fs.writeFileSync(

                "price.json",

                JSON.stringify(
                    {
                        lastPrice: price
                    },
                    null,
                    2
                )

            );

            console.log("Telegram sent.");

        } else {

            console.log("No change.");

        }

        await browser.close();

    } catch (err) {

        console.error(err);

        if (browser)
            await browser.close();

        process.exit(1);

    }

})();
