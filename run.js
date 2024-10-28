const fs = require("fs");
const puppeteer = require("puppeteer-core");
const normalNetworkPatterns = require("./normal-network-patterns.js");
const fastNetworkPatterns = require("./fast-network-patterns.js");
const stats = require("./stats");
const CHROME_PATH ="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CUR_MODEL = "RMPC"
let patterns;
if (process.env.npm_package_config_ffmpeg_profile === 'PROFILE_FAST') {
  patterns = fastNetworkPatterns;
} else {
  patterns = normalNetworkPatterns
}

const configNetworkProfile = process.env.npm_package_config_network_profile;
const NETWORK_PROFILE = patterns[configNetworkProfile] || patterns.PROFILE_CASCADE;
console.log("Network profile:", NETWORK_PROFILE);

run()
  .then((result) => {
    console.log("Test finished. Press cmd+c to exit.");
    if (!fs.existsSync('./results')){
      fs.mkdirSync('./results');
    }
    ts = Date.now();
    filenam = ts + "_" + CUR_MODEL + ".json";
    fs.writeFileSync(`./results/${filenam}`, JSON.stringify(result));
  })
  .catch(error => console.log(error));

async function run() {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: CHROME_PATH,
    defaultViewport: null,
    devtools: true,
  });

  const page = await browser.newPage();

  // Array to store console logs
  const consoleLogs = [];

  // Capture console logs
  page.on('console', msg => {
    consoleLogs.push(msg.text());
  });

  await page.goto("http://localhost:3000/samples/low-latency/testplayer/testplayer.html");



  // 等待“Load stream”按钮加载
  await page.waitForSelector('#load-button'); // 使用按钮的实际选择器
  await page.click('#load-button'); // 点击按钮
  await page.waitForFunction(() => window.startRecording !== undefined);

  const cdpClient = await page.target().createCDPSession();
  console.log("Waiting for player to setup.");
  await page.evaluate(() => {
    return new Promise(resolve => {
      const hasLoaded = window.app.player.getRepresentationsByType("video").length !== 0;
      if (hasLoaded) {
        console.log('Stream loaded, setup complete.');
        resolve();
      } else {
        console.log('Waiting for stream to load.');
        window.app.player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, (e) => {
          console.log('Load complete.')
          resolve();
      });
      }
    });
  });

  console.log("Waiting for 10 seconds of uninterrupted max-quality playback before starting.");
  const stabilized = await awaitStabilization(page);
  if (!stabilized) {
    console.error(
      "Timed out after 30 seconds. The player must be stable at the max rendition before emulation begins. Make sure you're on a stable connection of at least 3mbps, and try again."
    );
    return;
  }
  console.log("Player is stable at the max quality, beginning network emulation");
  page.evaluate(() => {
    window.startRecording();
  });

  await runNetworkPattern(cdpClient, NETWORK_PROFILE,page);

  const metrics = await page.evaluate(() => {
    if (window.stopRecording) {
      // Guard against closing the browser window early
      window.stopRecording();
    }
    window.app.player.pause();
    return window.abrHistory;
  });
  console.log("Run complete");
  const logMessage = `Run complete`;
  await page.evaluate(msg => {
    console.log(msg);
  }, logMessage);


  ts = Date.now();
  const logFileName = ts + "_" + CUR_MODEL + "_console_log.log";
  fs.writeFileSync(`./results/${logFileName}`, consoleLogs.join('\n'));
  if (!metrics) {
    console.log("No metrics were returned. Stats will not be logged.");
  }
  console.log("the metrics:")
  console.log(JSON.stringify(metrics, null, 2));
  ({ switchHistory, ...result } = metrics);
  result.averageBitrate = stats.computeAverageBitrate(switchHistory);
  result.numSwitches = switchHistory.length;
  console.log("the result:")
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function awaitStabilization (page) {
  return await page.evaluate(() => {
    console.log('Awaiting stabilization...')
    return new Promise(resolve => {
      const maxQuality = window.app.player.getRepresentationsByType("video").length - 1;
      console.log('Max quality:', maxQuality);
      let timer = -1;

      const failTimer = setTimeout(() => {
        resolve(false);
      }, 30000)

      console.log('Current quality:', window.app.player.getCurrentRepresentationForType("video").absoluteIndex);
      console.log('the result is: ',window.app.player.getCurrentRepresentationForType("video").absoluteIndex === maxQuality)

      if (window.app.player.getCurrentRepresentationForType("video").absoluteIndex === maxQuality) {
        console.log('Starting stabilization timer...')
        timer = setTimeout(() => {
          clearTimeout(failTimer);
          resolve(true);
        }, 10000);
      }

      window.app.player.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, e => {
        console.warn("Quality changed requested", e);
        if (e.newRepresentation.absoluteIndex !== maxQuality) {
          console.log('Clearing stabilization timer...', e.newQuality, maxQuality)
          clearTimeout(timer);
          timer = -1;
        } else if (timer === -1) {
          console.log('Starting stabilization timer...')
          timer = setTimeout(() => {
            clearTimeout(failTimer);
            resolve(true);
          }, 10000);
        }
      });
    });
  });
}

async function runNetworkPattern(client, pattern, page) {
  for await (const profile of pattern) {
    console.log(
      `Setting network speed to ${profile.speed}kbps for ${profile.duration} seconds`
    );
    const logMessage = `Setting network speed to ${profile.speed}kbps for ${profile.duration} seconds`;
    await page.evaluate(msg => {
      console.log(msg);
    }, logMessage);
    setNetworkSpeedInMbps(client, profile.speed);
    await new Promise(resolve => setTimeout(resolve, profile.duration * 1000));
  }
}

function setNetworkSpeedInMbps(client, mbps) {
  client.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    uploadThroughput: (mbps * 1024) / 8,
    downloadThroughput: (mbps * 1024) / 8
  });
}