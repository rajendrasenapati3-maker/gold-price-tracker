const { chromium } = require("playwright");
const axios = require("axios");
const fs = require("fs");

//============================
// CONFIGURATION
//============================
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const URL =
  "https://www.goodreturns.in/gold-rates/bhubaneswar.html";

//============================
// MAIN
//============================
(async () => {

    const browser = await chromium.launch({
        headless: true
    });

    const page = await browser.newPage();

    await page.goto(URL, {
        waitUntil: "networkidle",
        timeout: 60000
    });

    // Wait until the price is visible
    await page.waitForSelector("#24K-price");

    // Read price
    const priceText = await page.locator("#24K-price").innerText();

    // Example:
    // ₹14,433

    const currentPrice = priceText.replace(/[₹,\s]/g, "");

    console.log("Current Price:", currentPrice);

    //-------------------------------------
    // Read previous price
    //-------------------------------------

    let previousPrice = "";

    if (fs.existsSync("price.json")) {

        const data = JSON.parse(
            fs.readFileSync("price.json")
        );

        previousPrice = data.lastPrice;

    }

    //-------------------------------------
    // Compare
    //-------------------------------------

    if (currentPrice !== previousPrice) {

        console.log("Price Changed");

        let message =
`🏆 Bhubaneswar Gold Price

🥇 24K Gold

${priceText} / gram

Previous : ${previousPrice || "N/A"}

Current : ${priceText}

Time :
${new Date().toLocaleString("en-IN")}`;

        //---------------------------------
        // Telegram
        //---------------------------------

        await axios.post(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
            {
                chat_id: CHAT_ID,
                text: message
            }
        );

        //---------------------------------
        // Save latest price
        //---------------------------------

        fs.writeFileSync(
            "price.json",
            JSON.stringify(
                {
                    lastPrice: currentPrice
                },
                null,
                2
            )
        );

    } else {

        console.log("No Price Change");

    }

    await browser.close();

})();
